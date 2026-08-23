"""Canvas tools exposed to the Canvas Agent.

The tldraw editor lives in the browser, so these tools don't mutate anything
server-side. They return structured commands that travel back to the frontend,
which executes them against `editor.createShape` / bindings etc.

Command contract (frontend executor):
  {"command": "create_node", "arguments": {"shape": "rectangle", "label": "Auth API",
                                           "x": 120, "y": 240}}
Supported commands: create_node, create_text, create_note, connect,
update_label, move_node, delete_nodes.

Shapes are referenced by LABEL (connect/update/move/delete take from_label /
to_label / label), not ids — the agent never sees real tldraw shape ids.
x/y are optional; the frontend auto-places shapes that omit them.
"""


def get_canvas_state() -> dict:
    """Read the current canvas content.

    Returns a compact description of everything on the canvas:
    {"nodes": [{"id": "...", "label": "...", "shape": "rectangle"}],
     "edges": [{"from": "id1", "to": "id2", "label": "..."}]}
    """
    # ponytail: returns empty until the client starts posting snapshots;
    # until then the agent works from user text alone.
    return {"nodes": [], "edges": []}


def queue_canvas_command(command: str, arguments: dict) -> dict:
    """Queue one canvas command for the frontend to execute.

    Use `command` values:
      - create_node: {"shape": "rectangle"|"ellipse", "label": str, "x"?: int, "y"?: int}
      - create_text: {"text": str, "x"?: int, "y"?: int}
      - create_note: {"text": str, "color"?: str, "x"?: int, "y"?: int}
      - connect: {"from_label": str, "to_label": str, "label"?: str}
      - update_label: {"label": str, "new_label": str}
      - move_node: {"label": str, "x": int, "y": int}
      - delete_nodes: {"labels": [str]}
    x/y omitted = the frontend places it automatically.
    """
    # Commands reach the frontend via stream_chat intercepting the tool call
    # event itself — no collector needed here.
    return {"status": "queued", "command": command, "arguments": arguments}
