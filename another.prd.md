Read the full PRD. Your instinct is right — manual canvas first is the correct move, and here's why: tldraw gives you draw/text/shapes/select/zoom/pan for free (zero custom code), and the canvas serialization format becomes the foundation every AI feature reads from and writes to. You literally cannot build the Canvas Agent without it.
One adjustment I'd make to your thinking: don't leave the AI→canvas pipeline for last. It's the riskiest piece of the demo — build the manual canvas, then attack it early while you have time to iterate.
Step-by-step plan (mapped to the demo script)
Phase 1 — Canvas foundation (your instinct, correct)
- Install tldraw, create a /workspace route — canvas replaces the dashboard's center area. Sidebar/auth stay untouched (PRD says so).
- All manual capabilities (§5) come free with tldraw. Write zero custom shape code.
- Persistence: tldraw has getSnapshot()/loadSnapshot() — save that JSON to Mongo (workspaces collection, one per user). Debounced autosave.
- Export: tldraw's built-in exportToBlob (PNG) / SVG helpers. Done.
- ✅ Checkpoint: user can draw, reload, see their work, export.
Phase 2 — Partner shell
- Floating 🤖 button bottom-right → opens chat panel on the right (slide-over).
- Chat history persisted alongside workspace in Mongo.
- No AI yet — just plumbing.
Phase 3 — AI understands the canvas (read-only) ⚠️ start early
- Backend /api/chat: serialize canvas snapshot into a compact text form (shape type + text content + rough positions — don't dump raw tldraw JSON, it's noisy) plus current selection, into a Gemini prompt.
- Streaming responses into the chat panel.
- ✅ Checkpoint: canvas has Client → API → Auth Service, ask "Is this secure?", AI answers about that.
Phase 4 — AI writes to canvas (the core differentiator)
- Gemini structured output (JSON: nodes + edges) → Dagre computes layout → map to tldraw createShapesId calls (rects, arrows, labels). Same editable objects, never images (PRD §8/§12).
- Build this as backend tools/functions now; bolt Google ADK on later if time permits — plain function-calling covers the MVP.
- ✅ Checkpoint: "Visualize a secure auth system" → editable diagram appears.
Phase 5 — Researcher
- Web search (Gemini grounding is the lazy option — no separate search API wiring).
- Result cards in the panel with [Open Source] / [Add to Canvas] — the latter just creates note/text shapes.
Phase 6 — Selection-aware + quick canvas AI
- Selection already flows through Phase 3's context builder — mostly prompt work.
- Small input popover anchored to selection → creates shapes at that screen position (convert viewport coords → tldraw page coords).
Deliberately deferred (per PRD §17): Pub/Sub, Cloud Run, multi-user, shareable links. Local FastAPI + Vite until demo prep; deploy only if the hackathon requires it.
Sequencing logic: Phases 1–2 are safe wins, Phase 4 is where demos die — do it while energy is high. Want me to start Phase 1?