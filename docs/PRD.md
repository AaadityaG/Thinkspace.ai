# Thinkspace.ai — Product Requirements Document

> **Tagline:** Think visually. Research deeply. Build together.
> **Status:** Hackathon MVP

---

## 1. Overview

Thinkspace.ai is a visual workspace where users think, research, plan, and build with an AI collaborative partner.

The user works on an **infinite canvas** (tldraw). The AI can:

- Understand the canvas
- Answer questions
- Research topics
- Summarize sources
- Suggest improvements
- Create and edit diagrams
- Help with selected objects
- Act as a subject-matter expert

**The user always remains in control** and can manually edit anything the AI creates.

### The core idea

Thinkspace.ai should feel like:

> "There is an expert sitting beside me while I work on my canvas."

It should **not** feel like:

> "I am chatting with a chatbot that happens to have a canvas."

- The **canvas** is the primary workspace.
- The **AI** is the collaborative partner.

---

## 2. Target Users

| Priority | User | Use cases |
|----------|------|-----------|
| **Primary** | Developers | Software architecture, auth flows, system designs, APIs, databases, workflows, technical plans |
| **Secondary** | Researchers | Research questions, papers, evidence, hypotheses, knowledge maps, cause/effect relationships, literature research |
| **Future** | Specialists | Finance, accounting, legal, product, marketing, education, business strategy, science |

Future extensions are **not** MVP requirements.

---

## 3. Main User Flow

```
Login
  ↓
Thinkspace Workspace
  ↓
Infinite Canvas
  ↓
User draws / writes / adds information
  ↓
Opens Collaborative Partner
  ↓
Chats with AI
  ↓
AI understands canvas + request
  ↓
Research / Explain / Challenge / Visualize
  ↓
AI updates canvas when requested
  ↓
User manually edits
  ↓
Export
```

---

## 4. Main Screen Layout

Three main areas: **sidebar**, **canvas**, and **AI partner panel**.

```
┌──────────────────────────────────────────────────────┐
│ Sidebar                                              │
│        ┌─────────────────────────────────────┐       │
│        │                                     │       │
│        │           tldraw Canvas             │       │
│        │                                     │       │
│        └─────────────────────────────────────┘       │
│                                      ┌─────────────┐ │
│                                      │ 🤖 Partner  │ │
│                                      └─────────────┘ │
└──────────────────────────────────────────────────────┘
```

The existing authentication and sidebar remain unchanged.

---

## 5. Canvas

Use **tldraw** as the canvas engine.

Manual capabilities required:

- Draw freehand
- Add text
- Create shapes (rectangles, circles, arrows, lines)
- Move, resize, select, delete objects
- Zoom / pan

AI-generated content uses the **same editable canvas objects** — never locked images.

> **Important principle:** AI creates. Human controls.

---

## 6. Collaborative Partner

A floating button appears in the bottom-right (**🤖 Collaborative Partner**). Clicking it opens a chat panel from the right.

From the panel the user can:

- Ask questions
- Request research
- Request visualization
- Ask for explanations
- Ask the AI to critique the canvas
- Ask the AI to modify selected objects

### Example conversation

**User:** "I'm designing a secure authentication system."

**AI:** "I can help you research current best practices and then visualize an architecture. Would you like me to research it first?"

Suggested action buttons: `Research` · `Visualize` · `Explain` · `Challenge`

---

## 7. Research

When the user selects **Research**, the AI searches relevant sources (e.g., OWASP Authentication Cheat Sheet) and presents:

- Source title & link
- Short summary
- Important points (e.g., MFA, session management, credential security, rate limiting)
- Relevance to the user's question

Each result includes `[Open Source]` and `[Add to Canvas]` actions so useful research can be pinned to the canvas.

---

## 8. Visualization

After researching, the AI offers to visualize. If the user agrees, it creates an **editable diagram** on the canvas:

```
            ┌──────────┐
            │   User   │
            └────┬─────┘
                 ↓
            ┌──────────┐
            │ Frontend │
            └────┬─────┘
                 ↓
            ┌──────────┐
            │ Auth API │
            └────┬─────┘
          ┌──────┴──────┐
          ↓             ↓
 Identity Provider   Session Store
```

Every component is independently editable.

---

## 9. Canvas Context

The AI understands what is currently on the canvas.

Example: the canvas contains `Client → API → Auth Service → Database`, and the user asks *"Is this secure?"* — Thinkspace must resolve that "this" refers to the architecture on the canvas.

The AI receives:

- User message
- Canvas state
- Selected objects
- Relevant workspace context

---

## 10. Selection-Aware AI

The user selects an object (e.g., `Auth Service`) and interacts with the AI. The selected object becomes the context.

Examples:

- "Make this more secure."
- "Research this."
- "Add its dependencies."

---

## 11. Quick Canvas AI

A small contextual AI input appears near the cursor or selection:

```
    ┌───────────────┐
    │ Auth Service  │
    └───────────────┘
            ↓
    ┌────────────────┐
    │ Ask Thinkspace │
    └────────────────┘
```

User types "Create a database below this" → Thinkspace creates the appropriate tldraw object at that location.

**This is a core differentiating interaction.**

---

## 12. AI Architecture

The user sees one Collaborative Partner. Behind the scenes, the MVP uses four agents:

```
                Collaborative Partner
                         │
                    Orchestrator
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
   Domain Expert     Researcher      Canvas Agent
```

| Agent | Responsibility |
|-------|----------------|
| **Orchestrator** | Determines what needs to happen |
| **Domain Expert** | Software engineering expertise: architecture, APIs, authentication, databases, system design |
| **Researcher** | Web research, sources, summaries, evidence |
| **Canvas Agent** | Creating/editing shapes, connecting objects, building diagrams, positioning objects |

The user does not need to know which agent is being used.

### AI → Canvas pipeline

The AI never generates an image directly:

```
User request → Gemini → Structured diagram → Layout engine → Canvas tools → tldraw
```

Canvas tools include `create_rectangle()`, `create_text()`, `create_arrow()`, `connect_objects()` — keeping generated diagrams editable.

---

## 13. Export

MVP must support:

- **PNG** — presentations and sharing
- **SVG** — high-quality diagrams
- **Workspace save** — return and continue working

---

## 14. Persistence

Save per user/workspace:

- Canvas state
- Chat history
- Research results & sources
- Agent actions

Reuse the existing authentication system. MongoDB (Atlas) for application/workspace data.

---

## 15. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Existing app (React/Next.js), tldraw |
| AI | Gemini, Google ADK |
| Backend | Cloud Run |
| Database | MongoDB / MongoDB Atlas |
| Async work | Google Pub/Sub |
| Research | Web search, document/PDF processing |
| Diagram layout | ELK.js or Dagre |

---

## 16. MVP Demo Script

One scenario drives the entire hackathon demo:

1. Developer: *"Help me design a secure authentication system."*
2. AI researches current recommendations.
3. AI shows sources, summaries, key points.
4. User: *"Visualize it."*
5. AI creates an editable authentication architecture on tldraw.
6. User selects the Auth Service.
7. User: *"Make this more secure."* → AI modifies the architecture.
8. User clicks elsewhere; quick AI input appears → *"Add a database here."* → AI creates it.
9. User manually adjusts the diagram.
10. User exports as PNG/SVG.

**This is the MVP.**

---

## 17. Out of Scope

Not built for the hackathon:

- Real-time multi-user collaboration
- Shareable links
- Mobile application
- Dozens of specialist agents
- Voice interaction
- PDF export
- Billing
- Enterprise permissions
- Full code editor
- Advanced 3D graphics
- Complex project management

---

## 18. Future Roadmap

| Version | Focus |
|---------|-------|
| **V1 — Hackathon** | Think + Research + Visualize |
| **V2** | Share + collaborate — invite others to the canvas |
| **V3** | More subject experts — software, research, finance, legal, accounting, product, science |
| **V4** | Persistent AI partner — keeps researching and improving a workspace while the user is away |

---

## 19. Success Criteria

The MVP is successful if a user can:

- [ ] Create a workspace
- [ ] Draw manually
- [ ] Open the Collaborative Partner
- [ ] Ask a question and have the AI understand the canvas
- [ ] Research a topic and receive useful sources + summaries
- [ ] Request visualization and generate an editable diagram
- [ ] Manually modify the generated diagram
- [ ] Select an object and ask the AI to modify it
- [ ] Use contextual canvas AI
- [ ] Export as PNG/SVG

---

## 20. Product Principle

Everything follows one simple rule:

> Thinkspace.ai makes AI a **collaborator inside the user's thinking space**, not another chat window outside it.

- **Human** provides direction.
- **AI** provides expertise.
- **Canvas** is the shared workspace.
