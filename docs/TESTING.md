# Thinkspace.ai — Test Scenarios & Verification

How to prove every flow works. Two layers:

1. **Automated** (`backend/smoke_test.py`) — boots a real uvicorn server on :8011 and hits every API flow.
2. **Manual browser pass** — canvas/tldraw behavior can't be asserted headlessly; scripted checklist below.

---

## 1. Automated API verification

Prereqs: MongoDB reachable via `MONGO_DB` in `backend/.env` (Atlas works), venv active.

```powershell
cd backend
.venv\Scripts\python.exe smoke_test.py
```

Exit code 0 = all pass. DB-unreachable → DB checks report SKIP instead of FAIL.

### What it covers (14 checks)

| # | Check | Flow |
|---|-------|------|
| 1 | health endpoint | `GET /health` |
| 2 | register 201 + cookie | signup sets httpOnly session cookie |
| 3 | me returns user | cookie authenticates `GET /auth/me` |
| 4 | bad login 401 | wrong password rejected |
| 5 | login sets cookie | correct credentials log in |
| 6 | create workspace 201 | `POST /pages` |
| 7 | **cross-user read denied** | user B gets 404 for user A's page (IDOR guard) |
| 8 | rename workspace | `PATCH /pages/{id}` ownership-scoped |
| 9 | save snapshot | `PUT /pages/{id}/snapshot` tldraw store snapshot |
| 10 | read snapshot back | round-trip integrity of saved canvas |
| 11 | models endpoint | `GET /agents/models` returns whitelisted free models |
| 12 | chat streams NDJSON | `POST /agents/chat` streams `application/x-ndjson` events |
| 13 | graceful rate-limit note | 429 becomes a friendly text event — server never 500s |
| 14 | bogus model falls back | non-whitelisted `model` value ignored, stream still works |

**Status: 14/14 PASS** (verified against live Atlas + live Gemini 429 path).

> Note: with quota exhausted, check 12 shows `0 cmd` events (429 fires before any
> tool call). With quota available expect `N cmd` + final text. Both are healthy.

## 2. Frontend gates

```powershell
cd frontend
npm run build      # tsc -b && vite build — must be error-free
npx oxlint src/components/AgentChatPanel.tsx
```

## 3. Manual browser scenarios (`npm run dev` in frontend/, uvicorn :8008 in backend/)

### A. Workspace shell
- [ ] Sidebar "+ New" creates workspace, URL becomes `/workspace?id=<id>`
- [ ] Hover rename (pencil) updates name everywhere
- [ ] Delete removes card; if active, view falls back to another workspace (never blank crash)
- [ ] Reload keeps same workspace selected (URL is source of truth)

### B. Canvas autosave
- [ ] Draw a shape → wait ~2s (debounce) → reload page → shape persists
- [ ] Draw then IMMEDIATELY switch workspace → switch back → drawing persisted (switch-flush effect)

### C. Agent drawing — structured layout (dagre)
- [ ] New workspace, ask: *"Plan a food delivery startup"* → nodes appear staggered left-to-right in clean ranks with arrows, auto zoomToFit
- [ ] No coordinate mess: no overlapping boxes, edges attach to shape sides
- [ ] Ask: *"Add a risks note and connect it to Revenue"* → new note joins layout graph correctly

### D. Canvas awareness (Phase 1)
- [ ] Draw `User → API` manually, add note "needs rate limiting", ask: *"what's missing?"* → agent references existing labels/aliases, proposes e.g. Rate Limiter node between them
- [ ] Ask: *"rename API to Gateway"* → update_label applies to YOUR existing shape (alias map works)

### E. Mixed command routing
- [ ] Turn that both modifies existing shapes AND creates new ones: moves/deletes apply during streaming; creates/connects arrive laid-out after the burst
- [ ] Progress label shows "Designing… N" while buffering, then "Drawing…"

### F. Stop button
- [ ] Send long build prompt → click red **Stop** mid-stream → stream halts instantly, already-drawn shapes remain, "(stopped)" marker appended, input re-enabled immediately
- [ ] Stop before any reply arrives → shows "Stopped."

### G. Model picker
- [ ] Header select lists server models + "Server default"; choice survives reload (localStorage)
- [ ] Switch to a model whose bucket is fresh → requests succeed after previous model 429'd
- [ ] Session memory intact across switch: reference earlier context ("add what we discussed") still works

### H. Thread isolation
- [ ] Two workspaces get independent chat threads and independent agent memory; switching panels swaps history

### I. Error paths
- [ ] All-models-exhausted: friendly rate-limit bubble (never raw stack trace / stuck spinner)
- [ ] Model overloaded (Gemini 503 "high demand"): friendly overload bubble suggesting a model switch — stream stays alive
- [ ] Signed out: app redirects to auth, protected calls don't fire

## 4. Prompt scenarios — copy/paste into the Partner panel

Ordered from cheap to expensive (each burns quota; ~20/day/model).

### Warm-up / sanity
| Prompt | Expect |
|--------|--------|
| `hi` | Text-only reply, zero canvas commands |
| `what can you see on my canvas right now?` | Empty-canvas answer on fresh WS; lists shapes+notes on a populated one ([CANVAS STATE] flowing) |

### Structured drawing (dagre layout)
| Prompt | Expect |
|--------|--------|
| `draw a simple login flow` | 3–5 nodes LR ranks (User→Login→Auth...), arrows attached cleanly, zoomToFit |
| `plan a food delivery startup` | Meaningful decomposition (market/users/orders/revenue-style), NOT generic boxes; ≤10 nodes |
| `map out how our rate limiter works based on the note` | Uses YOUR existing shapes + the note text as input |
| `visualize the water cycle` | Non-software domain still lays out as clean graph |

### Canvas awareness & modification (needs pre-drawn content)
Setup: draw `User → API` manually + note "needs rate limiting".
| Prompt | Expect |
|--------|--------|
| `what's missing in this design?` | References existing labels by name; proposes Rate Limiter between User/API |
| `add it` | New node lands BETWEEN them, connected both ways (alias math works) |
| `rename API to Gateway` | Your existing shape relabels in place — nothing redrawn |
| `delete the rate limiter` | Only that node + its arrows vanish |
| `move Gateway to the right side` | move_node applies during stream (immediate path) |

### Mixed routing (modify + create in one turn)
| Prompt | Expect |
|--------|--------|
| `rename Auth to Login and then add a Database connected to it` | Rename hits your shape live; new node arrives via dagre burst after |
| `add risks notes for payments and connect each to Revenue` | create_note nodes join layout graph with edges |

### Stop-button torture
| Prompt | Expect |
|--------|--------|
| `design a full e-commerce system with users, catalog, cart, payments, shipping, reviews and admin` (click **Stop** at "Designing… 3") | Halts instantly, partial shapes stay, "(stopped)" marker, can send next prompt immediately |

### Model switching
| Step | Expect |
|------|--------|
| Draw something on model A until it 429s | Friendly limit bubble |
| Switch dropdown to model B, ask `what did we just build?` | Memory intact across switch (same session store), draws with B's bucket |

### Edge cases
| Prompt | Expect |
|--------|--------|
| `create 50 nodes of everything in a car factory` | Agent pushes back or caps (~10) per instruction; never hangs the tab |
| `asdfgh` | Graceful clarification, no commands fired |
| `connect Node A to Node B` (neither exists) | Creates them first or asks — never silent no-op |

## 5. Known constraints (not bugs)

- Free tier = ~20 req/day/model/project; multi-agent turns cost 6–10 calls.
- `gemini-2.5-flash` retired for new accounts; `gemini-3.7-flash` intermittently 503-overloaded.
- Agent model swap is process-global (fine single-user; per-user agents needed for real multi-tenancy).
