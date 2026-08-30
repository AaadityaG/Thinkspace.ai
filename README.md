# Thinkspace.ai

A space where human + Agents plan together.

An infinite visual canvas (powered by [tldraw](https://tldraw.dev)) where you can think, sketch, and build — with AI agents that read your canvas and draw on it alongside you.

## Features

- **Infinite canvas** — pan, zoom, draw, add notes/text/shapes (tldraw)
- **Workspaces** — multiple named canvases, autosaved as you work
- **Export** — PNG/SVG export via the tldraw menu
- **AI agents** — Google ADK + Gemini orchestrator with canvas tools (`backend/agents/`), exposed at `POST /api/agents/chat`

## Prerequisites

- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally (or a `MONGO_URI`)

---

## Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Edit `.env`:

```
MONGO_URI=mongodb://localhost:27017
JWT_SECRET=<any-long-random-string>
GOOGLE_API_KEY=<your key from https://aistudio.google.com/apikey>
GEMINI_MODEL=gemini-3.6-flash
```

### Frontend

```bash
cd frontend
npm install
```

---

## Run

Open two terminals:

**Terminal 1 — Backend**
```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --port 8008
```

> The backend must run on port **8008** — the frontend dev server proxies `/api` there.

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Frontend: http://localhost:5173
API docs: http://localhost:8008/docs

---

## Project Structure

```
Thinkspace.ai/
├── backend/
│   ├── agents/          # Google ADK agent: root_agent, runner, canvas tools, /agents/chat route
│   ├── auth/            # Register/login/logout/me routes + JWT cookie deps
│   ├── core/            # Settings (.env) and password hashing / JWT
│   ├── db/              # Mongo connection, models, indexes
│   ├── pages/           # Workspace CRUD + snapshot autosave API
│   └── main.py          # FastAPI app wiring
├── frontend/
│   └── src/
│       ├── components/  # AppShell (sidebar/header), ThemeProvider, UI primitives
│       ├── pages/       # Login, Register, Dashboard, Workspace (tldraw canvas)
│       ├── services/    # RTK Query slices (authApi, pagesApi)
│       └── store/       # Redux store
└── docs/
    └── PRD.md           # Product requirements
```
