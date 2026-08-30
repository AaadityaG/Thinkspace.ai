# Thinkspace.ai — Back-and-Forth Testing Scenarios

Multi-turn conversations that exercise the **whole system in one sitting** —
canvas understanding, drawing, editing, thread memory, model switching, and
error paths — in realistic back-and-forth exchanges.

Run each scenario start to finish in order. At the end you'll have touched
every layer: auth → workspace → canvas → agent chat → streaming draw →
edit → persist → reload.

> Pair with `TESTING.md` for the single-command checklist. These scenarios are
> the conversational version of that checklist.

---

## What changed in this stage (multi-agent + routing)

Previous stage had **one** orchestrator agent with only canvas tools. This
stage splits it into three routed agents:

| Agent | Tools | Handles |
|-------|-------|---------|
| **orchestrator** (`root_agent`) | `AgentTool(canvas_agent)`, `AgentTool(research_agent)` | Decides which specialist (or neither) to involve; answers casual chat directly |
| **canvas_agent** (new specialist) | `queue_canvas_command` | Draw / design / edit / visualize |
| **research_agent** (new specialist) | `web_search` (Wikipedia, keyless) | Real researched/sourced answers |

Two behavior changes to test:

1. **Live routing indicator** — runner now emits a new `routing` event; the
   panel shows a pill "**Canvas agent working…**" or "**Research agent
   working…**" while the matching specialist stream. See
   `backend/agents/runner.py` + `AgentChatPanel.tsx`.
2. **Research is real now** — `web_search` hits the Wikipedia API (no key
   needed). Research requests return actual titled source+link results instead
   of the model paraphrasing.

Also: the partner panel now only renders when a workspace exists
(suppressed on the empty/no-workspace shell — `Workspace.tsx`).

**Watch for the big regression risk:** orchestrator routing can misfire — a
"draw this" request routed to research (or vice versa), a combined
"research then draw" dropping the draw half, or research being skipped in
favor of a hallucinated answer. Table rows are tagged with the expected route:
**`[C]` = canvas_agent · `[R]` = research_agent · `[D]` = answered directly
(no specialist)** — so you can confirm each request hit the right agent.

---

## New routing checks (add to every scenario pass)

- [ ] Exact indicator shown per route:
  - **[R]** prompt → "Research agent working…" pill, then sources
  - **[C]** prompt → "Canvas agent working…" pill, then shapes appear
  - **[D]** chat → NO pill, plain answer, canvas untouched
- [ ] Combined request ("research, then draw") → pill appears **twice**
  (research then canvas), and BOTH sources AND the diagram arrive
- [ ] Indicator resets after each message; never sticks from the previous turn

---

## Scenario 1 — "Design a secure auth system" (primary demo path)

Drives the MVP demo script end to end: research → visualize → understand →
edit → persist. This is the money scenario.

| Route | # | User says | What should happen | Verifies |
|-------|---|-----------|--------------------|----------|
| [D] | 1 | *(fresh workspace)* `Design a secure authentication system for my app` | Agent replies conversationally; offers to research and/or visualize. No canvas changes yet. **No routing pill** | Orchestrator routing (neither specialist fired) |
| [R] | 2 | `Research current best practices` | **"Research agent working…"** pill, then real Wikipedia sources with titled links + snippets (e.g. authentication; OWASP-adjacent) | Researcher + real web_search |
| [C] | 3 | `Now visualize it` | **"Canvas agent working…"** pill, then Dagre diagram: User → Frontend → Auth API → split to Identity Provider + Session Store; arrows, zoomToFit | Structured drawing (dagre) + route switch |
| [C] | 4 | *(select the `Auth API` node)* `Is this node we drew actually secure?` | Agent resolves "this" = the selected/existing shape, not a fresh answer | Canvas awareness / selection context |
| [C] | 5 | `What's missing here?` | Identifies real gap (rate limiting / MFA) by name referencing existing labels | Canvas understanding by label |
| [C] | 6 | `Add a rate limiter between Auth API and the database` | New node lands BETWEEN them, connected both ways | create + connect layout (alias math) |
| [C] | 7 | `Rename Auth API to Gateway` | Your existing shape relabels in place, nothing redrawn | update_label / alias map |
| — | 8 | *(wait ~2s, reload page)* | Everything from steps 2–7 persists; same workspace selected | Autosave/persistence |
| [R] | 9 | `What did we build when we started?` | Recalls the whole thread (research → diagram → edits) from memory, NOT from a fresh research call | Session memory across specialists / thread isolation |
| [C] | 10 | *(draw a freehand circle, select it)* `Critique this doodle as a security diagram` | Responds about the selected object, no canvas mutation | Selection-aware AI, human-stays-in-control |

> New-critical: step 9 is a **regression trap**. Under the old single-aggregator
> model this answered from thread memory. Now the orchestrator must recall the
> earlier research instead of re-running `web_search`. A repeated "Research agent
> working…" pill on this step = wrong memory behavior.

**Pass = all 10 steps behave; every routing pill matches its route marker. Any
silent no-op, wrong-agent route, or "can't see" failure = bug.**

### 1a. Combined "research then draw" (multi-agent bridge)
Add after step 3, on a fresh area:
| Route | User says | What should happen | Verifies |
|-------|-----------|--------------------|----------|
| [R→C] | `Research load balancers, then draw a diagram of them behind the gateway` | Pill shows **"Research agent working…"**, sources stream; then pill **switches to "Canvas agent working…"**, diagram draws. BOTH are delivered | Orchestrator runs two specialists in one turn, in order; pill switches; nothing dropped |

---

## Scenario 2 — "Debug why my backend is slow" (iterative refine loop)

Exercises incremental editing across many turns — the "collaborator, not
chatbot" feel. Tests mixed command routing under pressure and a Stop.

| Route | # | User says | What should happen | Verifies |
|-------|---|-----------|--------------------|----------|
| [C] | 1 | `draw my current API: User hits a single gateway that calls a monolith` | 3 clean nodes: User → Gateway → Monolith. **"Canvas agent working…"** pill | Basic drawing |
| [C] | 2 | `the monolith is the bottleneck. split it into users, orders, and payments services` | Splits one node into three, reconnects Gateway → each | Edit-existing + batch create |
| [C] | 3 | `put a message queue between Gateway and orders` | Inserts Queue node between Gateway and Orders, both ways connected | Insert-in-the-middle routing |
| [C] | 4 | `rename orders service to order-service` | In-place relabel | update_label |
| [C] | 5 | *(select just `payments`)* `make this one a separate deployable that can retry` | Treats ONLY the selected node; adds retry note off it | Selection-scoped edit |
| [C] | 6 | `connect payments to a dead-letter queue and to queue` | Legacy/new naming — must still find `payments` and `queue` | Alias/label resolution |
| [C] | 7 | `now delete the dead-letter queue and draw a chart tier on top showing what scales first` | Delete + create in ONE turn (mixed routing): delete applies live, new arrives after | Mixed command routing |
| [C] | 8 | *(on the combined turn)* Let it print `Designing…` then click **Stop** | Halts instantly, partial shapes stay, "(stopped)" marker, input re-enabled; pill clears | Stop button + pill reset |
| [D] | 9 | *(switch model in the header)* `did we end up with a retry on payments?` | Recalls thread, answers about `payments` retry note from earlier. **No pill** | Memory across model switch + no wrong route |
| [D] | 10 | `summarize this whole design in 3 bullet points` | Pure-text summary; leaves canvas untouched. **No pill** | Orchestration knows when NOT to draw |

**Pass = every modify lands on the RIGHT node (label resolution) and edits
survive the Stop + model switch.**

---

## Scenario 3 — "Onboarding flow & errors" (happy + break it)

Tests signup, workspace lifecycle, thread isolation, and every error path —
the "does anything actually break" scenario. Best run on a **second workspace**
to prove isolation.

| Route | # | User says / does | What should happen | Verifies |
|-------|---|------------------|--------------------|----------|
| — | 1 | *(register new account, log in)* | Redirects to dashboard, protected calls auth'd | Auth flow |
| — | 2 | *(sidebar "+ New" → "Company Onboarding")* | Workspace created, URL has new id; **partner panel appears** | Workspace CRUD + panel-gated-on-workspace |
| [C] | 3 | `plan an onboarding flow for a SaaS` | **"Canvas agent working…"** pill; Dagre diagram of onboarding stages | Drawing on this workspace |
| [R] | 4 | *(switch to the earlier Scenario-1 workspace, ask)* `what was in the auth research you did?` | Recalls AUTH research — NOT onboarding. Independent thread/memory per workspace. **Research pill only if it actually searches** | Thread isolation of memory (research recall) |
| [C] | 5 | *(switch back to onboarding)* `add a step for payment before the email step` | Inserts node before the correct existing node in THIS thread | Isolation + insert |
| — | 6 | *(exhaust a model's quota / pick an overloaded one)* `anything` | Friendly rate-limit or overload bubble — never a stack trace / stuck spinner; stream stays alive | Error path mitigation |
| [D] | 7 | *(after the bubble, switch model)* `where were we?` | Recovers context, continues the onboarding thread. **No pill** | Graceful recovery + memory |
| [C] | 8 | `draw 50 nodes of everything in my factory` | Agent caps (~10) or pushes back; never hangs the tab | Overreach guard |
| [D] | 9 | `asdfgh` | Graceful clarification, zero canvas commands. **No pill, no shapes** | No-cmd fallback |
| — | 10 | *(delete this workspace card)* | Card removed; if it was active, view falls back cleanly, never blank-crashes. If no workspaces remain, **panel hides** | Workspace delete + fallback + panel gate |

> New in this stage: step 4 — research memory must also be per-workspace
> (the auth research from Scenario 1 must not leak into onboarding, and the
> orchestrator must NOT re-search on this step if the thread already has it).

**Pass = nothing ever 500s, blanks, or hangs; two workspaces never bleed
context into each other.**

---

## Final sweep checklist

- [ ] Reload mid/post-scenario → canvas + chat persist, same workspace selected
- [ ] Workspaces stay context-isolated — **including research memory** (Scenario 3 step 4)
- [ ] All error paths show friendly bubbles, not stack traces
- [ ] Stop button never leaves the input stuck
- [ ] Canvas edits are editable by hand (never locked images)
- [ ] Routing pill appears exactly for the executing specialist and clears after each turn
- [ ] Research returns titled source+URL results (never a made-up answer)
- [ ] Partner panel hidden when zero workspaces exist

## Known caveats (not bugs)

- Free tier ~20 req/day/model; multi-agent turns cost 6–10 calls — Scenario 3
  step 6 may just hit the real quota limit, which IS the friendly bubble test.
- Scenarios burn quota; run Scenario 1 (the demo) on a banked-up day.
