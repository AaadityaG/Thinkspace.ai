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

create_node shape vocabulary (make deliberate, meaningful choices):
  rectangle  = process / action / component
  diamond    = decision / branch / checkpoint
  ellipse    = actor / person / start or end
  trapezoid  = input / output / data store
  hexagon    = integration / shared service
  pentagon   = slow / batch / background step
  cloud      = external system / SaaS / third party
  triangle   = warning / urgent / dead-end
  Others (also valid): oval, star, check-box, x-box, arrow-right.

Optional style args (any combination; invalid values are ignored):
  create_node: geo (above), color, fill, font, dash, size
  create_text: color, font, size
  create_note: color
Valid values:
  color: black grey violet light-violet blue light-blue yellow orange green
         light-green light-red red white
  fill:  none solid semi      font: draw sans serif mono
  dash:  draw solid dashed dotted      size: s m l xl
Use shape + a small consistent color palette to group meaning (e.g. blue =
core flow, green = success, red = error, yellow = decision/warning, grey =
neutral). fill 'solid' or 'semi' with a light color for emphasis makes
diagrams look designed rather than default black boxes.
"""


def queue_canvas_command(command: str, arguments: dict) -> dict:
    """Queue one canvas command for the frontend to execute.

    Use `command` values:
      - create_node: {"shape": "rectangle"|"diamond"|"ellipse"|"cloud"|
                       "trapezoid"|"hexagon"|"pentagon"|"triangle"|...,
                       "label": str, "color"?: str, "fill"?: str,
                       "font"?: str, "dash"?: str, "size"?: str}
        Pick the shape that fits the meaning (diamond=decision,
        ellipse=actor/start/end, trapezoid=io/data, cloud=external system...).
      - create_text: {"text": str, "x"?: int, "y"?: int, "color"?: str, "font"?: str, "size"?: str}
      - create_note: {"text": str, "color"?: str}
      - connect: {"from_label": str, "to_label": str, "label"?: str}
        Connect requires a real origin AND target that already exist. A
        connection to a missing label is dropped, and after each turn any
        dangling / single-ended / pointless arrow is removed automatically.
        Use `label` sparingly: name an arrow only when it carries meaning — the
        outgoing branches of a decision (fraud check -> block = "high"), or a
        conditional/trigger edge. Leave ordinary linear flow edges unlabeled.
      - update_label: {"label": str, "new_label": str}
      - move_node: {"label": str, "x": int, "y": int}
      - delete_nodes: {"labels": [str]}
        Deletes the listed shapes AND every arrow connected to them, so
        obsolete components never leave orphaned/ghost arrows behind. Use this
        when redesigning/replacing part of an existing diagram.
    from_label/to_label/label may be an alias like "n2" from [CANVAS STATE].
    Do NOT pass coordinates for creates — the client auto-layouts your graph
    (dagre) from structure alone. x/y only matters for precise move_node.
    """
    return {"status": "queued", "command": command, "arguments": arguments}
