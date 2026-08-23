import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents.runner import stream_chat
from auth.deps import get_current_user

router = APIRouter(prefix="/agents", tags=["agents"])


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    # Scopes the conversation to one workspace so each canvas has its own
    # agent memory.
    page_id: str = Field(min_length=1, max_length=64)


@router.post("/chat")
async def agent_chat(body: ChatIn, user: dict = Depends(get_current_user)):
    """NDJSON stream: one {"type": "cmd", ...} line per canvas command as the
    agent emits it (frontend draws live), then {"type": "text", ...}."""
    async def gen():
        async for kind, payload in stream_chat(
            body.message, user_id=user["id"], session_id=f"{user['id']}:{body.page_id}"
        ):
            if kind == "cmd":
                event = {"type": kind, **payload}
            else:
                event = {"type": kind, "response": payload}
            yield json.dumps(event) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")
