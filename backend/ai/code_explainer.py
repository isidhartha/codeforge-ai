"""Explain code blocks using AI."""
import os
from typing import AsyncIterator
from backend.llm_service import complete as llm_complete
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import ExplainRequest

_LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()

logger = get_logger(__name__)
settings = get_settings()

EXPLAIN_SYSTEM = """You are CodeForge AI, an expert code reviewer and teacher.
Explain code clearly and concisely:
- Start with a one-line summary of what the code does
- Break down each significant part
- Note any potential bugs, performance issues, or code smells
- Suggest improvements if relevant
Use markdown with code blocks for any example code.
"""


async def stream_explanation(req: ExplainRequest) -> AsyncIterator[str]:
    """Stream a plain-English explanation of a code block."""
    prompt = _build_explain_prompt(req)
    logger.info("explaining_code", language=req.language, code_len=len(req.code))

    if _LLM_PROVIDER == "ollama":
        import asyncio
        text = await asyncio.get_event_loop().run_in_executor(
            None, lambda: llm_complete(prompt, system=EXPLAIN_SYSTEM)
        )
        yield text
        return

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    stream = await client.chat.completions.create(
        model=settings.ai_model,
        messages=[
            {"role": "system", "content": EXPLAIN_SYSTEM},
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


async def explain_once(req: ExplainRequest) -> str:
    """Return a complete explanation (non-streaming)."""
    chunks: list[str] = []
    async for chunk in stream_explanation(req):
        chunks.append(chunk)
    return "".join(chunks)


def _build_explain_prompt(req: ExplainRequest) -> str:
    parts = [f"Explain this {req.language} code:"]
    parts.append(f"```{req.language}\n{req.code}\n```")
    if req.context:
        parts.append(f"\nSurrounding context:\n```{req.language}\n{req.context}\n```")
    return "\n".join(parts)
