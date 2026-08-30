"""Headless flow verification — boots a real uvicorn server on :8011 and runs
auth, workspace CRUD, models endpoint and the chat stream against it (with
dead quota the chat check exercises the graceful-429 path).

Requires MongoDB reachable via MONGO_DB (.env works — Atlas is fine).
Run from backend/:  .venv\\Scripts\\python.exe smoke_test.py
"""

import json
import os
import signal
import subprocess
import sys
import time
import uuid

PORT = 8011
BASE = f"http://127.0.0.1:{PORT}"

# --- Preflight: is Mongo reachable? ---
from core.config import settings  # noqa: E402

db_up = False
if settings.MONGO_DB:
    import asyncio

    from motor.motor_asyncio import AsyncIOMotorClient

    async def _ping():
        client = AsyncIOMotorClient(settings.MONGO_DB, serverSelectionTimeoutMS=4000)
        try:
            await client.admin.command("ping")
            return True
        finally:
            client.close()

    try:
        db_up = asyncio.run(_ping())
    except Exception:
        db_up = False

print(
    f"Mongo: reachable ({settings.MONGO_DB.split('@')[-1]})"
    if db_up
    else "Mongo: NOT reachable — DB-gated checks will be skipped"
)

# --- Boot real server ---
server = subprocess.Popen(
    [
        sys.executable,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(PORT),
        "--log-level",
        "warning",
    ],
    cwd=os.path.dirname(os.path.abspath(__file__)),
)
try:
    import httpx

    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            if httpx.get(f"{BASE}/health", timeout=2).status_code == 200:
                break
        except Exception:
            time.sleep(0.5)
    else:
        raise RuntimeError("server did not come up")

    email = f"smoke-{uuid.uuid4().hex[:8]}@test.dev"
    ok = fail = skip = 0

    def check(name, cond, detail=""):
        global ok, fail
        if cond:
            ok += 1
            print(f"PASS  {name}")
        else:
            fail += 1
            print(f"FAIL  {name} {detail}")

    def skip_check(name):
        global skip
        skip += 1
        print(f"SKIP  {name} (no DB)")

    with httpx.Client(base_url=BASE, timeout=60) as c:
        check("health endpoint", c.get("/health").status_code == 200)

        if not db_up:
            for name in (
                "register 201 + cookie",
                "me returns user",
                "bad login 401",
                "login sets cookie",
                "create workspace 201",
                "cross-user read denied",
                "rename workspace",
                "save snapshot",
                "read snapshot back",
                "models endpoint lists free models",
                "chat streams NDJSON",
                "chat ends with text event or graceful rate-limit note",
                "bogus model falls back to server default (still streams)",
            ):
                skip_check(name)
        else:
            # --- Auth --- (no /api prefix: the Vite dev proxy adds+strips it)
            r = c.post(
                "/auth/register",
                json={"email": email, "name": "Smoke", "password": "Str0ngPass!x"},
            )
            check(
                "register 201 + cookie",
                r.status_code == 201 and "access_token" in c.cookies,
                r.text,
            )

            r = c.get("/auth/me")
            check(
                "me returns user",
                r.status_code == 200 and r.json()["user"]["email"] == email,
            )

            with httpx.Client(base_url=BASE, timeout=30) as c2:
                r = c2.post(
                    "/auth/login", json={"email": email, "password": "wrong"}
                )
                check("bad login 401", r.status_code == 401)
                r = c2.post(
                    "/auth/login", json={"email": email, "password": "Str0ngPass!x"}
                )
                check(
                    "login sets cookie",
                    r.status_code == 200 and "access_token" in c2.cookies,
                )

                # Ownership guard: a DIFFERENT user's workspace is invisible.
                r = c.post("/pages", json={"name": "Smoke WS"})
                pid = (r.json().get("page") or {}).get("id", "")
                check("create workspace 201", r.status_code == 201, r.text)
                email_b = f"smoke-b-{uuid.uuid4().hex[:8]}@test.dev"
                with httpx.Client(base_url=BASE, timeout=30) as c3:
                    rc = c3.post(
                        "/auth/register",
                        json={
                            "email": email_b,
                            "name": "B",
                            "password": "Str0ngPass!y",
                        },
                    )
                    if rc.status_code != 201:
                        check("second user registered", False, rc.text)
                    r = c3.get(f"/pages/{pid}")
                    check(
                        "cross-user read denied",
                        r.status_code == 404,
                        f"{r.status_code}",
                    )

            r = c.patch(f"/pages/{pid}", json={"name": "Renamed"})
            check(
                "rename workspace",
                r.status_code == 200 and r.json().get("ok") is True,
            )

            r = c.put(f"/pages/{pid}/snapshot", json={"snapshot": {"a": 1}})
            check("save snapshot", r.status_code == 200, f"{r.status_code} {r.text}")
            r = c.get(f"/pages/{pid}")
            check(
                "read snapshot back",
                (r.json().get("page") or {}).get("snapshot") == {"a": 1},
                r.text,
            )

            # --- Agents: model whitelist ---
            r = c.get("/agents/models")
            models = r.json().get("models", [])
            check(
                "models endpoint lists free models",
                r.status_code == 200 and len(models) >= 5,
                str(models),
            )

            def read_stream(resp):
                events = []
                for ln in resp.iter_lines():
                    try:
                        events.append(json.loads(ln))
                    except Exception:
                        pass
                return events

            # --- Chat stream ---
            payload = {"message": "draw a tiny diagram", "page_id": pid}
            if models:
                payload["model"] = models[0]
            with c.stream("POST", "/agents/chat", json=payload) as r:
                ctype = r.headers.get("content-type", "")
                events = read_stream(r) if r.status_code == 200 else []
            texts = [e for e in events if e.get("type") == "text"]
            cmds = [e for e in events if e.get("type") == "cmd"]
            stream_ok = ctype.startswith("application/x-ndjson") and len(events) > 0
            check("chat streams NDJSON", stream_ok, f"{r.status_code} {ctype}")
            check(
                "chat ends with text event or graceful rate-limit note",
                bool(texts),
                str(events[-1])[:300],
            )
            last = texts[-1]["response"] if texts else "-"
            print(
                f"\nsummary: {len(cmds)} cmd / {len(texts)} text events; "
                f"last text: {last[:160]}"
            )

            # Trust boundary: unknown model must NOT reach Gemini.
            with c.stream(
                "POST",
                "/agents/chat",
                json={"message": "hi", "page_id": pid, "model": "../../etc/passwd"},
            ) as r:
                bogus_ok = (
                    r.status_code == 200
                    and "ndjson" in r.headers.get("content-type", "")
                )
            check("bogus model falls back to server default (still streams)", bogus_ok)

    print(f"\n{ok} passed, {fail} failed, {skip} skipped")
finally:
    server.send_signal(signal.CTRL_BREAK_EVENT if os.name == "nt" else signal.SIGTERM)
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        server.kill()

raise SystemExit(1 if fail else 0)
