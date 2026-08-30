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
- [MongoDB](https://www.mongodb.com/try/download/community) running locally (or any `MONGO_DB` connection URI, e.g. from [MongoDB Atlas](https://www.mongodb.com/atlas))

---

## Setup

### 1. Backend

MongoDB must be running before you start the backend. If it can't connect, the API still boots but DB-backed endpoints (register, login, pages, chat history) will fail.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Edit `backend/.env` — all variables:

| Variable | Description | Example |
|---|---|---|
| `APP_NAME` | API name shown in docs | `Thinkspace.ai` |
| `APP_VERSION` | Version string | `0.1.0` |
| `DEBUG` | FastAPI debug flag | `true` |
| `ALLOWED_ORIGINS` | CORS origins allowed to call the API (JSON array) | `["http://localhost:5173"]` |
| `MONGO_DB` | MongoDB connection URI (required) | `mongodb://localhost:27017` |
| `MONGO_DB_NAME` | Database name | `thinkspace` |
| `JWT_SECRET` | Signing key for login/register tokens; generate with `openssl rand -hex 32` (required) | `c8ec...` |
| `JWT_EXPIRE_DAYS` | Token lifetime in days | `7` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (only needed for "Continue with Google") | — |
| `GOOGLE_API_KEY` | Gemini API key from https://aistudio.google.com/apikey (required for AI agents) | `AQ.AB8...` |
| `GEMINI_MODEL` | Gemini model the agents use | `gemini-3.5-flash` |

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Edit `frontend/.env`:

| Variable | Description | Example |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth client ID as the backend (used by the Google login button; leave empty to disable it). Must match the backend's `GOOGLE_CLIENT_ID` when enabled | — |
| `VITE_API_URL` | Backend base URL for API calls. **Set this (e.g. `http://localhost:8008`) while running the backend and frontend together** — all requests go straight to the backend. Leave it empty to fall back to Vite's `http://localhost:8008` dev-server proxy on `/api` instead | `http://localhost:8008` |

---

## Run

Open two terminals:

**Terminal 1 — Backend**
```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --port 8008
```

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
