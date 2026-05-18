"""AI debugging assistant — explain errors and suggest fixes."""
from typing import AsyncIterator
from openai import AsyncOpenAI
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import DebugRequest

logger = get_logger(__name__)
settings = get_settings()

DEBUG_SYSTEM = """You are CodeForge AI, an expert debugger.
When given an error and code:
1. Identify the root cause clearly
2. Explain why the error occurs
3. Provide a corrected version of the relevant code in a fenced code block
4. List any other potential issues you notice
Be precise and actionable. Format output in markdown.
"""


async def stream_debug(req: DebugRequest) -> AsyncIterator[str]:
    """Stream a debugging analysis and suggested fix."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = _build_debug_prompt(req)

    logger.info("debugging", language=req.language, error_len=len(req.error))

    stream = await client.chat.completions.create(
        model=settings.ai_model,
        messages=[
            {"role": "system", "content": DEBUG_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        max_tokens=settings.max_tokens,
        stream=True,
        temperature=0.2,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def _build_debug_prompt(req: DebugRequest) -> str:
    parts = [f"Language: {req.language}", f"\nError:\n```\n{req.error}\n```"]
    if req.code.strip():
        parts.append(f"\nCode:\n```{req.language}\n{req.code}\n```")
    parts.append("\nDiagnose the error and provide a fix:")
    return "\n".join(parts)
