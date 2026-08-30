# Thinkspace.ai — Demo Scenarios

Scripted demos of the **single collaborative agent** on the shared canvas. The
agent reads what's on the canvas, draws clean flowchart-style diagrams with
deliberate shapes and colors, and edits / redesigns what exists.

- **Scenario 1 (primary / money path)** — think → visualize → understand →
  edit → persist. The safe, polished demo.
- **Scenario 2 (crazy demo)** — show-off path for a crowd.
- **Scenario 3 (deep build) — `"MotoDash" ride-hailing & food delivery`** — a
  single long-running session that grows a whole startup's system architecture
  from a rough brainstorm to a complex, color-coded, failure-hardened diagram
  through many connected steps. **Best standalone demo.**

Run from a fresh workspace. Pair with `TESTING.md` for the automated + manual
checklist.

---

## Scenario 1 — "Design a secure auth system"

The whole flow in one sitting: plan, draw, question the diagram, refine it,
persist, then recall it from memory.

| # | User says / does | What should happen | Verifies |
|---|------------------|--------------------|----------|
| 1 | *(fresh workspace)* `Design a secure authentication system for my app` | Agent draws a clean flowchart: `User` (ellipse/actor) → `Frontend` → `Auth API` (rectangles/process), splitting to `Identity Provider` + `Session Store`; diamonds/decisions and a color grouping where they add meaning. Auto-zoom. | Guided visualize → structured, visually designed layout |
| 2 | *(select the `Auth API` node)* `Is this node we drew actually secure?` | Agent resolves "this" = the selected/existing shape and answers from the canvas, not a fresh guess | Canvas awareness / selection context |
| 3 | `What's missing here?` | Identifies a real gap (e.g. rate limiting / MFA) by name, referencing existing labels | Canvas understanding by label |
| 4 | `Add a rate limiter between Auth API and the database` | New node lands between them, connected both ways | create + connect layout (alias math) |
| 5 | `Rename Auth API to Gateway` | Your existing shape relabels in place; nothing redrawn | update_label / alias map |
| 6 | *(wait ~2s, reload page)* | Everything from steps 1–5 persists; same workspace selected | Autosave / persistence |
| 7 | `What did we build when we started?` | Recalls the whole thread (diagram + edits) from memory, no re-draw | Session memory across turns |
| 8 | `Draw decision nodes for each security check and color the risky ones red` | Adds/updates diamond decision nodes; risky checks get `red`/`light-red` color + `solid` fill | Shape vocabulary + color-for-meaning |

**Pass = all 8 steps behave: shapes draw cleanly with appropriate geo types
and colors, edits land on the right nodes, the page reloads intact, and the
agent recalls context without redrawing. Any silent no-op or "can't see it"
failure = bug.**

---

## Scenario 2 — "Crazy demo" (show-off path)

The fun one for a crowd. Shows the partner building a rich, color-coded,
well-laid-out system diagram and redesigning it live.

| # | User says / does | What should happen | Verifies |
|---|------------------|--------------------|----------|
| 1 | `Map the full flow of ordering a pizza, using the right shapes: diamonds for decisions, an oval for the customer, a cloud for the delivery service` | Agent builds a complete flowchart: Customer (oval) → Menu → `Hungry?` (diamond) → Place Order (rect) → Payment (rect), and `Delivery Service` as a cloud; logical arrows, clean ranks | Broad geo vocabulary honored end to end |
| 2 | `Make the unhappy path stand out: color anything that can fail red and mark the payment-as-pending step dashed` | Failure-prone nodes tinted `red`, pending/async edges drawn `dashed` | Color + dash communicate risk |
| 3 | `Where's the biggest risk in this flow?` | Picks a real node (e.g. Payment) referencing its label + color | Canvas awareness (label + color) |
| 4 | *select the Customer oval* `turn this into a rectangle and connect it straight to Place Order` | Selected oval relabels shape type to rectangle and reconnects | (Optional) selection-aware type edit if supported, else honest limit |
| 5 | `We're now a drone delivery startup. Redesign the flow for that ` | Rebuilds the diagram around drones: Drone Fleet (hexagon/cloud), FAA Approval (diamond), dispatch, landing; keeps a consistent palette | Creative redesign + memory + consistent visual language |
| 6 | `in 3 bullets why would this fail?` | Pure-text critique; canvas untouched | Orchestrator knows when NOT to draw |
| 7 | *(wait ~2s, reload)* `What were we just building?` | Split diagram persisted; agent recalls the whole thread | Persistence + session memory |

**Pass = diagrams use deliberate shapes (diamond decision, oval actor, cloud
external) and a consistent color palette, edits hit the right nodes, and the
agent stays creative yet coherent across a full redesign.**

---

## Scenario 3 — "MotoDash" (deep build)

The longest, most complex demo: one sitting grows a ride-hailing + food
delivery marketplace from a loose brainstorm into a hardened, color-coded
system architecture. Every step builds on the last, ratcheting up shape +
color vocabulary, canvas awareness, editing, and failure modeling.

| # | User says / does | What should happen | Verifies |
|---|------------------|--------------------|----------|
| 1 | `Let's design a food delivery + ride-hailing startup called MotoDash. Show the core flow: a Customer can order food or book a ride, both go to a Driver, and payment happens third-party.` | Agent draws a clean core flow: `Customer` **ellipse** → `Book Food` + `Book Ride` (rectangles) → both to a `Driver` **hexagon** (shared service) → `Payment` **cloud** (external/stripe). Decisions where branching happens. Color-forward layout (blue core flow). | Rich single diagram from one prompt: actors, branches, shared service, external SaaS + consistent palette |
| 2 | `Where do the orders and rides get stored? Add the data stores.` | Adds `Order Store` and `Ride Store` as **trapezoids** (data stores) feeding off the book steps; connected. | Shape vocabulary grows on demand (trapezoid = data store) |
| 3 | `Now a courier joins mid-route: when a driver accepts, show the decision whether to reassign if the order is late.` | Inserts a `Late?` **diamond** decision after driver acceptance, branching to `Reassign` (rectangle) or `Continue`; connected both ways into existing layout. | Insert-in-the-middle + decision node |
| 4 | `Color the happy path green end-to-end and the failure paths red, and mark any slow weekly payroll as a pentagon.` | Recolors the success/processing flow `green`/`light-green`, the reject/failure edges `red`, and the weekly payout step becomes a **pentagon** (batch/slow); dashed for async. | Color-for-meaning across many nodes + pentagon batch shape |
| 5 | *select a node on the happy path* `route around this if it goes down` | Agent targets the exact selected node, draws a **triangle** (warning) + `Requeue` fallback arrow, and a dashed bypass to `Dead Letter` **cloud** | Selection-aware + triangle-as-warning + graceful degradation edit |
| 6 | `Add a fraud check when a new customer pays: if risk is high, block; if medium, hold for review.` | Inserts `Fraud Check` **diamond** with three outgoing branches — `Block` (`red`), `Hold Review` (`yellow`), `Approve` (`green`) — and a `Review Queue` **trapezoid**. The three branch arrows are **labelled** `high` / `medium` / `low` (routing), while linear flow edges stay unlabeled. | Multi-branch diamond + three-tier color risk palette + balanced edge labels |
| 7 | `What's the most fragile part of this system right now?` | Picks a real node (e.g. the single Driver/hexagon or Payment cloud), names it by label + color, proposes a mitigation | Canvas awareness (label + color + shape semantics) |
| 7a | `Actually, re-route it: let rides bypass the Driver shared service and go straight to Payment.` | Topology changes — the old `Book Ride → Driver` arrow is removed or replaced, no duplicate/orphan arrow remains; only the intended `Book Ride → Payment` link persists | Arrow cleanup on re-route |
| 7b | *(manually delete one node's arrow endpoint on the canvas, wait for the next turn)* | The now-single-ended / dangling arrow is swept away; no floating line remains pointing at nothing | Prune of pointless (one-ended/missing-endpoint) arrows |
| 8 | `Rename the fraud review queue to manual-review and add a note explaining why we hold high-value orders.` | In-place relabel + a `create_note` annotation pinned to the trapzoid | update_label + note annotation |
| 9 | `We're expanding to 3 cities. Show the regional split with dashed failover arrows and a note on which region fails over where.` | Dashed failover edges + `create_note` for region failover; keeps the palette consistent; no over-crowding | Dashed async/failover styling + notes + restraint |
| 10 | `This is getting big — shrink to just the payment + delivery spine and drop the fraud internals.` | **Deletes** the fraud/region internals via delete_nodes, collapse to the core spine, keeps arrows coherent — **no orphaned arrows left hanging off removed nodes, no duplicate connections** | Delete + simplify + remember what to keep + arrow cleanup |
| 11 | *(wait ~2s, reload)* `What did MotoDash end up looking like and what was its biggest risk?` | Full architecture persists; agent recalls the thread, summarizes the final diagram + names the risk from earlier | Persistence + long-horizon session memory |
| 12 | `In 4 bullet points, what would kill this company first?` | Pure-text critique, canvas untouched | Orchestrator knows when NOT to draw |

**Pass = one continuous session grows a complex, readable, color-coded
architecture; shape+color always carry meaning; edits target the right nodes;
delete/simplify works with no leftover arrows; every turn can reference the
prior turns' labels. Any silent no-op, lost-edge, or "can't see it" failure =
bug.**

---

## Quick sanity prompts (before the demo)

| Prompt | Expect |
|--------|--------|
| `hi` | Text-only reply, zero canvas commands |
| `what can you see on my canvas right now?` | Correct empty-canvas answer on a fresh workspace; lists shapes with kind + color + label on a populated one |

## Stop button (optional)

Send a long build prompt (e.g. `design a full e-commerce system with users,
catalog, cart, payments, shipping, reviews and admin`), click red **Stop**
mid-stream → halts instantly, partial shapes stay, input re-enabled immediately.

## Known constraints (not bugs)

- Free tier ~20 req/day/model; a demo turn costs a few calls — run the demo on a
  day with quota banked.
- Model picker in the header survives reload (localStorage); switching models
  keeps session memory.
- The agent only reports shapes it can label (rect/ellipse/diamond/note/text);
  raw freehand strokes and images aren't returned in canvas state.
