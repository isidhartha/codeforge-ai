"""Explain code blocks using AI."""
from typing import AsyncIterator
from openai import AsyncOpenAI
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import ExplainRequest

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
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = _build_explain_prompt(req)

    logger.info("explaining_code", language=req.language, code_len=len(req.code))

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
