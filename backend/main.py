"""CodeForge AI — FastAPI backend application."""
import asyncio
import json
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Path as FPath
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from shared.config import get_settings
from shared.logging import configure_logging, get_logger
from shared.models import (
    ChatRequest,
    CompletionRequest,
    DebugRequest,
    ExplainRequest,
    FileWriteRequest,
    GenerateRequest,
    IndexRequest,
    SearchRequest,
    TerminalNLRequest,
    TerminalRunRequest,
)
from ai.code_assistant import stream_chat, stream_completion
from ai.code_explainer import stream_explanation
from ai.debugger import stream_debug
from ai.generator import stream_generated_code
from ide.file_system import list_files, read_file, write_file
from ide.project_indexer import index_directory, search
from ide.terminal_runner import CommandNotAllowedError, run_command, stream_command

configure_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("codeforge_ai_starting", version="1.0.0")
    yield
    logger.info("codeforge_ai_stopping")


app = FastAPI(
    title="CodeForge AI",
    description="AI-powered Browser IDE & Coding Environment",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────────────────────────────────────────────────
# Health
# ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "CodeForge AI", "version": "1.0.0"}


# ────────────────────────────────────────────────────────────────────
# AI — Code Completion (streaming)
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/ai/complete")
async def ai_complete(req: CompletionRequest) -> StreamingResponse:
    """Stream AI code completions for the given cursor context."""
    async def _gen() -> AsyncIterator[str]:
        try:
            async for chunk in stream_completion(req):
                yield chunk
        except Exception as exc:
            logger.error("completion_error", error=str(exc))
            yield f"\n[Error: {exc}]"

    return StreamingResponse(_gen(), media_type="text/plain")


# ────────────────────────────────────────────────────────────────────
# AI — Explain
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/ai/explain")
async def ai_explain(req: ExplainRequest) -> StreamingResponse:
    """Stream an explanation of a selected code block."""
    async def _gen() -> AsyncIterator[str]:
        try:
            async for chunk in stream_explanation(req):
                yield chunk
        except Exception as exc:
            logger.error("explain_error", error=str(exc))
            yield f"\n[Error: {exc}]"

    return StreamingResponse(_gen(), media_type="text/plain")


# ────────────────────────────────────────────────────────────────────
# AI — Generate
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/ai/generate")
async def ai_generate(req: GenerateRequest) -> StreamingResponse:
    """Stream generated code from a natural language specification."""
    async def _gen() -> AsyncIterator[str]:
        try:
            async for chunk in stream_generated_code(req):
                yield chunk
        except Exception as exc:
            logger.error("generate_error", error=str(exc))
            yield f"\n[Error: {exc}]"

    return StreamingResponse(_gen(), media_type="text/plain")


# ────────────────────────────────────────────────────────────────────
# AI — Debug
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/ai/debug")
async def ai_debug(req: DebugRequest) -> StreamingResponse:
    """Stream debugging analysis and fix suggestions for an error."""
    async def _gen() -> AsyncIterator[str]:
        try:
            async for chunk in stream_debug(req):
                yield chunk
        except Exception as exc:
            logger.error("debug_error", error=str(exc))
            yield f"\n[Error: {exc}]"

    return StreamingResponse(_gen(), media_type="text/plain")


# ────────────────────────────────────────────────────────────────────
# AI — Chat (streaming)
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/ai/chat")
async def ai_chat(req: ChatRequest) -> StreamingResponse:
    """Stream a general coding chat response."""
    async def _gen() -> AsyncIterator[str]:
        try:
            async for chunk in stream_chat(req.messages, req.selected_code, req.language):
                yield chunk
        except Exception as exc:
            logger.error("chat_error", error=str(exc))
            yield f"\n[Error: {exc}]"

    return StreamingResponse(_gen(), media_type="text/plain")


# ────────────────────────────────────────────────────────────────────
# Terminal — Run command
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/terminal/run")
async def terminal_run(req: TerminalRunRequest) -> dict:
    """Execute a shell command within the allowed command list."""
    try:
        result = await run_command(req)
        return result.model_dump()
    except CommandNotAllowedError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ────────────────────────────────────────────────────────────────────
# Terminal — Natural language to command
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/terminal/nl")
async def terminal_nl(req: TerminalNLRequest) -> dict:
    """Convert a natural language query into a shell command."""
    from ai.code_assistant import stream_chat as _chat
    from shared.models import ChatMessage

    system_msg = ChatMessage(
        role="system",
        content=(
            "Convert the user's natural language request into a single shell command. "
            "Reply ONLY with valid JSON: {\"command\": \"<cmd>\", \"explanation\": \"<why>\", \"safe\": true/false}"
        ),
    )
    user_msg = ChatMessage(role="user", content=req.query)

    chunks: list[str] = []
    async for chunk in _chat([system_msg, user_msg]):
        chunks.append(chunk)

    raw = "".join(chunks).strip()
    try:
        # Extract JSON from potential markdown fences
        if "```" in raw:
            raw = raw.split("```")[1].replace("json", "", 1).strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"command": "", "explanation": raw, "safe": False}


# ────────────────────────────────────────────────────────────────────
# Project — Index
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/project/index")
async def project_index(req: IndexRequest) -> dict:
    """Index a project directory for semantic search."""
    try:
        count = index_directory(req.directory, req.extensions)
        return {"indexed_files": count, "directory": req.directory}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ────────────────────────────────────────────────────────────────────
# Project — Search
# ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/project/search")
async def project_search(req: SearchRequest) -> dict:
    """Semantic search across indexed project files."""
    result = search(req)
    return result.model_dump()


# ────────────────────────────────────────────────────────────────────
# Files
# ────────────────────────────────────────────────────────────────────

@app.get("/api/v1/files")
async def files_list(path: str = "") -> list:
    """List files in the workspace (or a sub-directory)."""
    items = list_files(path)
    return [f.model_dump() for f in items]


@app.get("/api/v1/files/{file_path:path}")
async def files_read(file_path: str) -> dict:
    """Read file content from the workspace."""
    try:
        content, encoding = await read_file(file_path)
        return {"path": file_path, "content": content, "encoding": encoding}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.put("/api/v1/files/{file_path:path}")
async def files_write(file_path: str, req: FileWriteRequest) -> dict:
    """Write content to a workspace file."""
    try:
        await write_file(file_path, req.content, req.encoding)
        return {"path": file_path, "written": True, "size": len(req.content)}
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


# ────────────────────────────────────────────────────────────────────
# WebSocket — AI streaming
# ────────────────────────────────────────────────────────────────────

@app.websocket("/ws/ai-stream")
async def ws_ai_stream(ws: WebSocket) -> None:
    """WebSocket endpoint for streaming AI responses."""
    await ws.accept()
    logger.info("ws_ai_stream_connected")

    try:
        while True:
            data = await ws.receive_json()
            action = data.get("action", "chat")
            payload = data.get("payload", {})

            if action == "complete":
                req = CompletionRequest(**payload)
                async for chunk in stream_completion(req):
                    await ws.send_json({"type": "chunk", "content": chunk})
                await ws.send_json({"type": "done"})

            elif action == "chat":
                from shared.models import ChatMessage as CM
                messages = [CM(**m) for m in payload.get("messages", [])]
                selected = payload.get("selected_code")
                language = payload.get("language")
                async for chunk in stream_chat(messages, selected, language):
                    await ws.send_json({"type": "chunk", "content": chunk})
                await ws.send_json({"type": "done"})

            elif action == "explain":
                req = ExplainRequest(**payload)
                async for chunk in stream_explanation(req):
                    await ws.send_json({"type": "chunk", "content": chunk})
                await ws.send_json({"type": "done"})

            elif action == "debug":
                req = DebugRequest(**payload)
                async for chunk in stream_debug(req):
                    await ws.send_json({"type": "chunk", "content": chunk})
                await ws.send_json({"type": "done"})

            elif action == "generate":
                req = GenerateRequest(**payload)
                async for chunk in stream_generated_code(req):
                    await ws.send_json({"type": "chunk", "content": chunk})
                await ws.send_json({"type": "done"})

            else:
                await ws.send_json({"type": "error", "content": f"Unknown action: {action}"})

    except WebSocketDisconnect:
        logger.info("ws_ai_stream_disconnected")
    except Exception as exc:
        logger.error("ws_ai_stream_error", error=str(exc))
        try:
            await ws.send_json({"type": "error", "content": str(exc)})
        except Exception:
            pass


# ────────────────────────────────────────────────────────────────────
# WebSocket — Interactive terminal
# ────────────────────────────────────────────────────────────────────

@app.websocket("/ws/terminal")
async def ws_terminal(ws: WebSocket) -> None:
    """WebSocket endpoint for interactive terminal with streaming output."""
    await ws.accept()
    logger.info("ws_terminal_connected")

    try:
        while True:
            data = await ws.receive_json()
            command = data.get("command", "").strip()
            working_dir = data.get("working_dir")

            if not command:
                continue

            await ws.send_json({"type": "start", "command": command})

            try:
                async for line in stream_command(command, working_dir):
                    await ws.send_json({"type": "output", "data": line})
            except CommandNotAllowedError as exc:
                await ws.send_json({"type": "error", "data": str(exc)})
            except Exception as exc:
                await ws.send_json({"type": "error", "data": f"Error: {exc}"})

            await ws.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info("ws_terminal_disconnected")
    except Exception as exc:
        logger.error("ws_terminal_error", error=str(exc))
