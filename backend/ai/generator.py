"""Spec-to-code generator — create entire files or functions from plain English."""
import os
from typing import AsyncIterator
from backend.llm_service import complete as llm_complete
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import GenerateRequest

_LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()

logger = get_logger(__name__)
settings = get_settings()

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
    logger.info("generating_code", language=req.language, spec_len=len(req.spec))

    if _LLM_PROVIDER == "ollama":
        import asyncio
        text = await asyncio.get_event_loop().run_in_executor(
            None, lambda: llm_complete(prompt, system=GENERATE_SYSTEM)
        )
        yield text
        return

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    stream = await client.chat.completions.create(
        model=settings.ai_model,
        messages=[
            {"role": "system", "content": GENERATE_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        max_tokens=settings.max_tokens,
        stream=True,
        temperature=0.3,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


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
