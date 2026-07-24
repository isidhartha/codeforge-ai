"""Universal LLM provider service — supports all major AI providers + Ollama."""
from __future__ import annotations

import os
from typing import Any

LLM_PROVIDER = (
    os.getenv("AI_PROVIDER") or os.getenv("LLM_PROVIDER") or "ollama"
).lower()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("AI_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")


def _ollama_chat(messages: list[dict], **kwargs) -> str:
    import requests
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={"model": OLLAMA_MODEL, "messages": messages, "stream": False},
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            "Ollama is not running. Start with: ollama serve\n"
            "Install from https://ollama.com — then: ollama pull llama3.2"
        )


def _openai_chat(messages: list[dict], **kwargs) -> str:
    import openai
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    resp = client.chat.completions.create(model=OPENAI_MODEL, messages=messages, **kwargs)
    return resp.choices[0].message.content


def _anthropic_chat(messages: list[dict], **kwargs) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    user_msgs = [m for m in messages if m["role"] != "system"]
    kw: dict[str, Any] = {"model": ANTHROPIC_MODEL, "max_tokens": 4096, "messages": user_msgs}
    if system:
        kw["system"] = system
    r = client.messages.create(**kw)
    return r.content[0].text


def _openai_compat(messages: list[dict], base_url: str, api_key: str, model: str, **kwargs) -> str:
    import openai
    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    r = client.chat.completions.create(model=model, messages=messages, **kwargs)
    return r.choices[0].message.content


def chat(messages: list[dict], **kwargs) -> str:
    p = LLM_PROVIDER
    if p == "ollama":
        return _ollama_chat(messages, **kwargs)
    elif p == "openai":
        return _openai_chat(messages, **kwargs)
    elif p == "anthropic":
        return _anthropic_chat(messages, **kwargs)
    elif p in ("gemini", "google"):
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        genai.configure(api_key=api_key)
        m = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-1.5-flash"))
        prompt = "\n".join(f"{msg['role']}: {msg['content']}" for msg in messages)
        return m.generate_content(prompt).text
    elif p == "nvidia":
        return _openai_compat(
            messages,
            base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
            api_key=os.getenv("NVIDIA_API_KEY", ""),
            model=os.getenv("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct"),
            **kwargs,
        )
    elif p == "deepseek":
        return _openai_compat(
            messages,
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
            api_key=os.getenv("DEEPSEEK_API_KEY", ""),
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            **kwargs,
        )
    elif p == "groq":
        return _openai_compat(
            messages,
            base_url="https://api.groq.com/openai/v1",
            api_key=os.getenv("GROQ_API_KEY", ""),
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            **kwargs,
        )
    elif p == "mistral":
        return _openai_compat(
            messages,
            base_url="https://api.mistral.ai/v1",
            api_key=os.getenv("MISTRAL_API_KEY", ""),
            model=os.getenv("MISTRAL_MODEL", "mistral-small-latest"),
            **kwargs,
        )
    else:
        return _ollama_chat(messages, **kwargs)


def complete(prompt: str, system: str | None = None, **kwargs) -> str:
    msgs: list[dict] = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    return chat(msgs, **kwargs)


async def stream_chat(messages: list[dict], **kwargs):
    """Async generator for streaming responses (OpenAI/Anthropic only, falls back to full response)."""
    p = LLM_PROVIDER
    if p == "openai":
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        async with client.chat.completions.stream(
            model=OPENAI_MODEL, messages=messages
        ) as stream:
            async for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
    elif p == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        system = next((m["content"] for m in messages if m["role"] == "system"), None)
        user_msgs = [m for m in messages if m["role"] != "system"]
        kw: dict[str, Any] = {"model": ANTHROPIC_MODEL, "max_tokens": 4096, "messages": user_msgs}
        if system:
            kw["system"] = system
        async with client.messages.stream(**kw) as stream:
            async for text in stream.text_stream:
                yield text
    else:
        response = chat(messages, **kwargs)
        yield response
