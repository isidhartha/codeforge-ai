"""Spec-to-code generator — create entire files or functions from plain English."""
from typing import AsyncIterator
from llm_service import stream_chat as llm_stream_chat
from shared.logging import get_logger
from shared.models import GenerateRequest

logger = get_logger(__name__)

GENERATE_SYSTEM = """You are CodeForge AI, an expert software engineer.
Generate complete, production-quality code from specifications.
Rules:
- Output ONLY the code inside a fenced code block (no prose before/after unless asked)
- Include all necessary imports
- Add clear docstrings/comments
- Handle edge cases and errors appropriately
- Use idiomatic patterns for the target language
- If generating a full file, include a module docstring at the top
"""


async def stream_generated_code(req: GenerateRequest) -> AsyncIterator[str]:
    """Stream generated code from a natural language specification."""
    prompt = _build_generate_prompt(req)
    logger.info("generating_code")
    messages = [
        {"role": "system", "content": GENERATE_SYSTEM},
        {"role": "user", "content": prompt},
    ]
    async for chunk in llm_stream_chat(messages):
        yield chunk


async def generate_once(req: GenerateRequest) -> str:
    """Return complete generated code (non-streaming)."""
    chunks: list[str] = []
    async for chunk in stream_generated_code(req):
        chunks.append(chunk)
    return "".join(chunks)


def _build_generate_prompt(req: GenerateRequest) -> str:
    parts = [f"Language: {req.language}"]
    if req.file_path:
        parts.append(f"Target file: {req.file_path}")
    parts.append(f"\nSpecification:\n{req.spec}")
    if req.context:
        parts.append(f"\nExisting code context:\n```{req.language}\n{req.context}\n```")
    parts.append(f"\nGenerate complete {req.language} code:")
    return "\n".join(parts)
