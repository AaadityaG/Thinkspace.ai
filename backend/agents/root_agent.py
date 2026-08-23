from core.config import settings

from google.adk.agents import LlmAgent

from agents.canvas_tools import queue_canvas_command

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
        "- User messages may include a [CANVAS STATE] block listing what is already "
        "drawn (aliased n1, n2, ... plus edges). Read it before answering questions "
        "about 'this', 'the diagram', or 'my canvas' — you can see it.\n"
        "- When asked to modify existing shapes, reference them by alias or by their "
        "exact label via update_label / move_node / delete_nodes / connect.\n"
        "- When the user asks you to visualize or build something, queue canvas "
        "commands with queue_canvas_command: first create_node for every component, "
        "then connect for each relationship. Lay out top-to-bottom, spaced ~200px "
        "vertically and centered on x=0.\n"
        "- Be concise, practical and challenge weak assumptions when relevant."
    ),
    tools=[queue_canvas_command],
)
