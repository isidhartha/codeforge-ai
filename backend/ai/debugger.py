"""AI debugging assistant — explain errors and suggest fixes."""
import os
from typing import AsyncIterator
from backend.llm_service import complete as llm_complete
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import DebugRequest

_LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()

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
    prompt = _build_debug_prompt(req)
    logger.info("debugging", language=req.language, error_len=len(req.error))

    if _LLM_PROVIDER == "ollama":
        import asyncio
        text = await asyncio.get_event_loop().run_in_executor(
            None, lambda: llm_complete(prompt, system=DEBUG_SYSTEM)
        )
        yield text
        return

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
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
