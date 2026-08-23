from collections.abc import AsyncIterator

from google.adk.runners import InMemoryRunner
from google.genai import errors as genai_errors
from google.genai import types

from agents.root_agent import root_agent

APP_NAME = "thinkspace"
_runner: InMemoryRunner | None = None


def get_runner() -> InMemoryRunner:
    global _runner
    if _runner is None:
        _runner = InMemoryRunner(agent=root_agent, app_name=APP_NAME)
    return _runner


async def stream_chat(
    message: str,
    user_id: str,
    session_id: str,
    model: str | None = None,
) -> AsyncIterator[tuple[str, dict | str]]:
    """Yield ('cmd', canvas_command) as the agent calls tools, then ('text', reply)
    once the final response lands. Sessions persist per (app, user, session_id),
    so pass the same id across calls to keep conversation history."""
    if model:
        # ponytail: global model swap — fine for single-user demo flow; per-user
        # agents if concurrent multi-tenant use ever matters.
        root_agent.model = model
    runner = get_runner()
    session = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if session is None:
        await runner.session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    content = types.Content(role="user", parts=[types.Part(text=message)])
    final = ""
    try:
        async for event in runner.run_async(
            user_id=user_id, session_id=session_id, new_message=content
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    # Surface each canvas command the instant the model emits
                    # it, so the frontend draws shapes live instead of all at
                    # once.
                    if (
                        part.function_call
                        and part.function_call.name == "queue_canvas_command"
                    ):
                        yield (
                            "cmd",
                            {
                                "command": part.function_call.args.get("command"),
                                "arguments": part.function_call.args.get(
                                    "arguments"
                                )
                                or {},
                            },
                        )
            if event.is_final_response() and event.content and event.content.parts:
                final += "".join(part.text or "" for part in event.content.parts)
    except genai_errors.ClientError as e:
        # Free tier: ~20 requests/day per model — fail with a readable chat
        # message instead of a 500 + traceback.
        code = getattr(e, "code", None)
        if code == 429 or "429" in str(e):
            yield (
                "text",
                "I hit the Gemini free-tier rate limit (20 requests/day per "
                "model). Try again later, set GEMINI_MODEL to another model "
                "with quota left, or enable billing on your API key.",
            )
            return
        raise
    yield "text", final


async def chat(message: str, user_id: str, session_id: str) -> tuple[str, list]:
    """Non-streaming convenience wrapper around stream_chat."""
    commands: list = []
    text = ""
    async for kind, payload in stream_chat(message, user_id, session_id):
        if kind == "cmd":
            commands.append(payload)
        else:
            text = payload
    return text, commands
