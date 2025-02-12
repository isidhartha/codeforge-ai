"""AI code completion and streaming chat assistant."""
import os
from typing import AsyncIterator, Optional
from backend.llm_service import complete as llm_complete, chat as llm_chat
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import ChatMessage, CompletionRequest

_LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()

logger = get_logger(__name__)
settings = get_settings()

COMPLETION_SYSTEM = """You are CodeForge AI, an expert coding assistant embedded in a browser IDE.
When completing code:
- Complete only the missing part, not what already exists
- Match the existing style, indentation, and language
- Be concise — provide a single best completion
- Do not add markdown fences or explanations, just code
"""

CHAT_SYSTEM = """You are CodeForge AI, an expert software engineer embedded in a browser IDE.
You help with code review, debugging, architecture, and explaining concepts.
When showing code:
- Use markdown code blocks with the correct language tag
- Keep explanations concise but accurate
- If the user shares selected code, treat it as the primary context
"""


def _build_openai_client():
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def stream_completion(req: CompletionRequest) -> AsyncIterator[str]:
    """Stream a code completion for the given context."""
    prompt = _build_completion_prompt(req)
    logger.info("streaming_completion", language=req.language, tokens=settings.max_tokens)

    if _LLM_PROVIDER == "ollama":
        import asyncio
        text = await asyncio.get_event_loop().run_in_executor(
            None, lambda: llm_complete(prompt, system=COMPLETION_SYSTEM)
        )
        yield text
        return

    client = _build_openai_client()
    stream = await client.chat.completions.create(
        model=settings.ai_model,
        messages=[
            {"role": "system", "content": COMPLETION_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        max_tokens=min(512, settings.max_tokens),
        stream=True,
        temperature=0.2,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def stream_chat(
    messages: list[ChatMessage],
    selected_code: Optional[str] = None,
    language: Optional[str] = None,
) -> AsyncIterator[str]:
    """Stream a general coding chat response."""
    openai_messages = [{"role": "system", "content": CHAT_SYSTEM}]

    if selected_code:
        lang = language or "text"
        openai_messages.append({
            "role": "system",
            "content": f"The user has selected the following code ({lang}):\n```{lang}\n{selected_code}\n```",
        })

    for msg in messages:
        openai_messages.append({"role": msg.role, "content": msg.content})

    logger.info("streaming_chat", message_count=len(messages))

    if _LLM_PROVIDER == "ollama":
        import asyncio
        text = await asyncio.get_event_loop().run_in_executor(
            None, lambda: llm_chat(openai_messages)
        )
        yield text
        return

    client = _build_openai_client()
    stream = await client.chat.completions.create(
        model=settings.ai_model,
        messages=openai_messages,
        max_tokens=settings.max_tokens,
        stream=True,
        temperature=0.4,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def _build_completion_prompt(req: CompletionRequest) -> str:
    before = req.code[: req.cursor_position] if req.cursor_position else req.code
    after = req.code[req.cursor_position:] if req.cursor_position else ""
    parts = [f"Language: {req.language}"]
    if req.file_path:
        parts.append(f"File: {req.file_path}")
    parts.append(f"Code before cursor:\n{before}")
    if after.strip():
        parts.append(f"Code after cursor:\n{after}")
    parts.append("Complete the code at the cursor position:")
    return "\n".join(parts)
