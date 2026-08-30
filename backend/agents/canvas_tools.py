"""Canvas tool exposed to the agent.

The tldraw editor lives in the browser, so this tool doesn't mutate anything
server-side. Commands travel back to the frontend via stream_chat (which
intercepts the tool-call events) and are executed against the live editor.

The current canvas content reaches the agent as a [CANVAS STATE] block inside
the user's message (summarized client-side), so there is no get_canvas_state
tool — the agent can see existing shapes and reference them by alias ("n3")
or by their visible label.

Command contract (frontend executor):
  {"command": "create_node", "arguments": {"shape": "rectangle", "label": "Auth API",
                                           "x": 120, "y": 240}}
Supported commands: create_node, create_text, create_note, connect,
update_label, move_node, delete_nodes.

Shapes are referenced by LABEL or ALIAS (connect/update/move/delete take
from_label / to_label / label). x/y are optional; the frontend auto-places
shapes that omit them.
"""


def queue_canvas_command(command: str, arguments: dict) -> dict:
    """Queue one canvas command for the frontend to execute.

    Use `command` values:
      - create_node: {"shape": "rectangle"|"ellipse", "label": str}
      - create_text: {"text": str, "x"?: int, "y"?: int}
      - create_note: {"text": str}
      - connect: {"from_label": str, "to_label": str, "label"?: str}
      - update_label: {"label": str, "new_label": str}
      - move_node: {"label": str, "x": int, "y": int}
      - delete_nodes: {"labels": [str]}
    from_label/to_label/label may be an alias like "n2" from [CANVAS STATE].
    Do NOT pass coordinates for creates — the client auto-layouts your graph
    (dagre) from structure alone. x/y only matters for precise move_node.
    """
    return {"status": "queued", "command": command, "arguments": arguments}
