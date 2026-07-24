"""AI code completion and streaming chat assistant."""
import asyncio
from typing import AsyncIterator, Optional
from llm_service import complete as llm_complete, stream_chat as llm_stream_chat
from shared.logging import get_logger
from shared.models import ChatMessage, CompletionRequest

logger = get_logger(__name__)

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


async def stream_completion(req: CompletionRequest) -> AsyncIterator[str]:
    """Stream a code completion for the given context."""
    prompt = _build_completion_prompt(req)
    logger.info("streaming_completion")
    messages = [
        {"role": "system", "content": COMPLETION_SYSTEM},
        {"role": "user", "content": prompt},
    ]
    async for chunk in llm_stream_chat(messages):
        yield chunk


async def stream_chat(
    messages: list[ChatMessage],
    selected_code: Optional[str] = None,
    language: Optional[str] = None,
) -> AsyncIterator[str]:
    """Stream a general coding chat response."""
    llm_messages = [{"role": "system", "content": CHAT_SYSTEM}]
    if selected_code:
        lang = language or "text"
        llm_messages.append({
            "role": "system",
            "content": f"The user has selected the following code ({lang}):\n```{lang}\n{selected_code}\n```",
        })
    for msg in messages:
        llm_messages.append({"role": msg.role, "content": msg.content})

    logger.info("streaming_chat")
    async for chunk in llm_stream_chat(llm_messages):
        yield chunk


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
