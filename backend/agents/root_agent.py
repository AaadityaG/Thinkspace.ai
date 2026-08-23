from core.config import settings

from google.adk.agents import LlmAgent

from agents.canvas_tools import get_canvas_state, queue_canvas_command

# ADK / google-genai read the key from os.environ directly, so make sure the
# .env value is visible there (pydantic Settings alone doesn't export it).
import os

if settings.GOOGLE_API_KEY:
    os.environ.setdefault("GOOGLE_API_KEY", settings.GOOGLE_API_KEY)


root_agent = LlmAgent(
    name="orchestrator",
    model=settings.GEMINI_MODEL,
    description="Thinkspace.ai collaborative partner — thinks with the user on a shared canvas.",
    instruction=(
        "You are Thinkspace.ai's collaborative partner: an expert sitting beside "
        "the user while they work on an infinite canvas.\n"
        "- Understand what is on the canvas via get_canvas_state before answering "
        "questions about 'this' or 'the diagram'.\n"
        "- When the user asks you to visualize or build something, queue canvas "
        "commands with queue_canvas_command: first create_node for every component, "
        "then connect for each relationship. Lay out top-to-bottom, spaced ~200px "
        "vertically and centered on x=0.\n"
        "- Be concise, practical and challenge weak assumptions when relevant."
    ),
    tools=[get_canvas_state, queue_canvas_command],
)
