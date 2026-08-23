import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents.runner import stream_chat
from auth.deps import get_current_user
from core.config import settings

router = APIRouter(prefix="/agents", tags=["agents"])


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    # Scopes the conversation to one workspace so each canvas has its own
    # agent memory.
    page_id: str = Field(min_length=1, max_length=64)
    # Compact [CANVAS STATE] summary from the client (aliased shapes/edges).
    # The agent reads it as part of the user turn — no read-back channel needed.
    canvas: str | None = Field(default=None, max_length=6000)
    # Optional model override; must be whitelisted in settings.FREE_MODELS.
    model: str | None = Field(default=None, max_length=64)


@router.get("/models")
async def list_models(user: dict = Depends(get_current_user)):
    """Free-tier models for the frontend picker."""
    return {"models": settings.FREE_MODELS}


@router.post("/chat")
async def agent_chat(body: ChatIn, user: dict = Depends(get_current_user)):
    """NDJSON stream: one {"type": "cmd", ...} line per canvas command as the
    agent emits it (frontend draws live), then {"type": "text", ...}."""
    message = body.message
    if body.canvas:
        message += f"\n\n{body.canvas}"

    model = body.model if body.model in settings.FREE_MODELS else None

    async def gen():
        async for kind, payload in stream_chat(
            message,
            user_id=user["id"],
            session_id=f"{user['id']}:{body.page_id}",
            model=model,
        ):
            if kind == "cmd":
                event = {"type": kind, **payload}
            else:
                event = {"type": kind, "response": payload}
            yield json.dumps(event) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")
