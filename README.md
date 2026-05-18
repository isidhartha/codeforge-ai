# CodeForge AI — AI Browser IDE & Coding Environment

A fully featured, browser-based IDE powered by AI — bringing the intelligence of modern AI coding assistants directly into a Monaco-editor environment accessible from any browser.

---

## Screenshot

```
+------------------------------------------------------------------+
|  [CodeForge AI]  [New File]  [Open]  [Run]  [Debug]  [AI Chat]  |
+----------------+-------------------------------+------------------+
| File Explorer  |     Monaco Editor (center)    |  AI Assistant   |
|                |                               |                 |
| > src/         |  function greet(name: str)    | > Ask anything  |
|   main.py      |      return f"Hello {name}"   |                 |
|   utils.py     |                               | [Explain Code]  |
| > tests/       |  // AI Suggestion:            | [Generate Code] |
|   test_main.py |  // def greet_all(names):     | [Debug Error]   |
|                |  //   return [greet(n) for..] |                 |
+----------------+-------------------------------+-----------------+
| Terminal                              AI: "Run: python main.py"  |
| $ python main.py                                                  |
| Hello World                                                       |
+------------------------------------------------------------------+
```

---

## Features

- **Browser-Based Monaco IDE** — Full VS Code-like editing experience with syntax highlighting for 20+ languages, IntelliSense, and multi-tab support
- **AI Coding Assistant** — Streaming AI chat sidebar powered by GPT-4o or Claude; context-aware with selected code injection
- **Intelligent Autocomplete** — AI-powered completions triggered by Ctrl+Space, beyond standard LSP completions
- **Repo Understanding** — Index any codebase and ask questions about it using semantic search
- **Spec-to-Code Generation** — Describe what you need in plain English; get complete working files/functions
- **AI Debugging** — Paste an error trace; get an explanation and suggested fix applied directly to your code
- **AI Terminal Assistant** — Type natural language commands; get shell commands with explanations
- **Embedded xterm.js Terminal** — Full interactive terminal with WebSocket streaming
- **Project Indexing** — Semantic search across your entire project using embeddings
- **code-server Integration** — Full VS Code in the browser via the official codercom/code-server Docker image on port 8080

---

## Architecture

```
                        Browser
         +-----------------------------------------+
         |  React Frontend (port 3000)             |
         |  Monaco Editor | AI Sidebar | Terminal  |
         +-----------+-----------------------------+
                     | HTTP / WebSocket
         +-----------v-----------------------------+
         |  FastAPI Backend (port 8000)            |
         |  /api/v1/ai/*   /api/v1/files/*         |
         |  /ws/ai-stream  /ws/terminal            |
         +-----------+-----------------------------+
                     |
         +-----------v------+   +----------------+
         |  Redis (cache /  |   |  code-server   |
         |  session store)  |   |  port 8080     |
         +------------------+   +----------------+
```

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An OpenAI API key (or Anthropic API key)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/codeforge-ai.git
cd codeforge-ai
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 2. Launch

```bash
docker-compose up --build
```

### 3. Open

| Service | URL | Description |
|---------|-----|-------------|
| CodeForge AI IDE | http://localhost:3000 | Custom React + Monaco IDE |
| code-server (VS Code) | http://localhost:8080 | Full VS Code in browser |
| Backend API | http://localhost:8000 | FastAPI + docs at /docs |
| Redis | localhost:6379 | Cache & sessions |

---

## API Reference

Full API documentation is available at `http://localhost:8000/docs` (Swagger UI) after starting the backend.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/ai/complete` | Streaming code completion |
| POST | `/api/v1/ai/explain` | Explain selected code |
| POST | `/api/v1/ai/generate` | Generate code from spec |
| POST | `/api/v1/ai/debug` | Debug error + fix |
| POST | `/api/v1/ai/chat` | General coding chat (streaming) |
| POST | `/api/v1/terminal/run` | Execute a shell command |
| POST | `/api/v1/terminal/nl` | Natural language to command |
| POST | `/api/v1/project/index` | Index a project directory |
| POST | `/api/v1/project/search` | Semantic search in project |
| GET | `/api/v1/files` | List files |
| GET | `/api/v1/files/{path}` | Read file |
| PUT | `/api/v1/files/{path}` | Write file |
| WS | `/ws/ai-stream` | Streaming AI responses |
| WS | `/ws/terminal` | Interactive terminal |

---

## Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Configuration

All configuration is via environment variables. See `.env.example` for the full list.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (alternative) |
| `AI_MODEL` | `gpt-4o` | Model to use |
| `REDIS_URL` | `redis://redis:6379` | Redis connection |
| `WORKSPACE_DIR` | `/workspace` | Root directory for file ops |
| `TERMINAL_ALLOWED_COMMANDS` | `ls,pwd,...` | Allowlisted shell commands |
| `MAX_TOKENS` | `4096` | Max tokens per AI response |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT — see [LICENSE](LICENSE).
