# CodeForge AI

[![Discussions](https://img.shields.io/github/discussions/isidhartha/codeforge-ai)](https://github.com/isidhartha/codeforge-ai/discussions)

The premise is simple: your IDE should be running everywhere, and it should understand what you're building.

CodeForge AI is a browser-based coding environment with an AI assistant built into the core — not bolted on as a chat sidebar. You get a Monaco editor (the same editor that powers VS Code), a real terminal, a file explorer, and an AI that has context about your entire project and can act on it. Run it once in Docker and you've got a full IDE accessible from any browser on your network.

---

## What it does

**Monaco editor** — Full VS Code-like editing experience in the browser. Syntax highlighting for 20+ languages, multi-tab support, and a file tree. If you've used VS Code, the muscle memory transfers immediately.

**AI coding assistant** — A chat panel that's aware of the file you're editing and can see your selection. Ask it to explain a function, suggest a refactor, generate a test, or translate a piece of code to another language. Responses stream in real time.

**Code generation from specs** — Describe what you want in plain English. "Write a FastAPI endpoint that accepts a JSON body with a user ID and returns the user's recent orders from a PostgreSQL database." It produces working code you can drop into your project.

**AI debugging** — Paste in an error trace and the code that produced it. It explains what went wrong, why, and shows you the fix. It can also run your code in the terminal and work from the actual output.

**Smart autocomplete** — AI-powered completions that go beyond standard IntelliSense. It considers what you're building, not just what symbols are in scope.

**Interactive terminal** — Real xterm.js terminal running in the browser over WebSocket. Type commands, see output. You can also type in plain English and it'll suggest the shell command you meant.

**Project semantic search** — Index your codebase and ask questions about it. "Where is the database connection pool initialized?" or "Which files handle authentication?" It understands structure, not just text.

**code-server** — The full VS Code experience in the browser is also available at port 8080, powered by the official codercom/code-server image. If you need something the custom IDE doesn't have yet, it's right there.

---

## How to run it

**Prerequisites**: Docker and Docker Compose. An OpenAI or Anthropic API key.

**1. Clone and configure**

```bash
git clone https://github.com/isidhartha/codeforge-ai.git
cd codeforge-ai
cp .env.example .env
```

Open `.env` and add your API key:

```
OPENAI_API_KEY=sk-your-key-here
# or

[![Discussions](https://img.shields.io/github/discussions/isidhartha/codeforge-ai)](https://github.com/isidhartha/codeforge-ai/discussions)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**2. Start everything**

```bash
docker-compose up --build
```

**3. Open the IDE**

| URL | What's there |
|---|---|
| http://localhost:3000 | CodeForge AI — the custom React + Monaco IDE |
| http://localhost:8080 | code-server — full VS Code in the browser |
| http://localhost:8000/docs | Backend API docs (Swagger UI) |

---

## Without Docker

```bash
# Backend

[![Discussions](https://img.shields.io/github/discussions/isidhartha/codeforge-ai)](https://github.com/isidhartha/codeforge-ai/discussions)
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)

[![Discussions](https://img.shields.io/github/discussions/isidhartha/codeforge-ai)](https://github.com/isidhartha/codeforge-ai/discussions)
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

---

## API

Full Swagger UI at `http://localhost:8000/docs`.

```
POST /api/v1/ai/complete      — AI code completion (streaming)
POST /api/v1/ai/explain       — Explain a piece of code
POST /api/v1/ai/generate      — Generate code from a description
POST /api/v1/ai/debug         — Debug an error and suggest a fix
POST /api/v1/ai/chat          — General coding chat
POST /api/v1/terminal/run     — Execute a shell command
POST /api/v1/terminal/nl      — Natural language to shell command
POST /api/v1/project/index    — Index a project directory for search
POST /api/v1/project/search   — Semantic search across indexed project
GET  /api/v1/files            — List files
GET  /api/v1/files/{path}     — Read a file
PUT  /api/v1/files/{path}     — Write a file
WS   /ws/ai-stream            — Streaming AI responses
WS   /ws/terminal             — Interactive terminal session
```

---

## Configuration

| Variable | Default | What it does |
|---|---|---|
| `OPENAI_API_KEY` | — | OpenAI for AI features |
| `ANTHROPIC_API_KEY` | — | Anthropic alternative |
| `AI_MODEL` | `gpt-4o` | Model to use |
| `REDIS_URL` | `redis://redis:6379` | Session and cache storage |
| `WORKSPACE_DIR` | `/workspace` | Root for file operations |
| `MAX_TOKENS` | `4096` | Max tokens per AI response |

---

## Free local LLM option (no API key needed)

CodeForge AI can run its AI features entirely on your machine using [Ollama](https://ollama.com) — no OpenAI account or API key required.

**1. Install Ollama**

Download from https://ollama.com and install it. Then pull a model:

```bash
ollama pull llama3.2
```

**2. Set the provider in `.env`**

```
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

Leave `OPENAI_API_KEY` blank. All AI features (completion, explanation, generation, debugging, chat) will be routed to your local Ollama instance.

**3. Start Ollama and then the stack**

```bash
ollama serve          # keep this running in one terminal
docker-compose up --build
```

If you're running Ollama on your host machine and the backend inside Docker, the compose file already sets `OLLAMA_BASE_URL=http://host.docker.internal:11434` so the container can reach it. On Linux, you may need to use your host's LAN IP instead of `host.docker.internal`.

Note: Ollama returns full responses rather than streaming tokens, so AI responses will appear all at once instead of word-by-word. Streaming is preserved when using OpenAI.

**Switching back to OpenAI** is just changing `LLM_PROVIDER=openai` in `.env` and restarting the backend.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The agent and tool system is modular — adding a new AI capability usually means adding one endpoint and one handler function.

---

## License

MIT.
