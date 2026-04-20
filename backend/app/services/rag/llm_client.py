import logging
import os
from typing import AsyncGenerator

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        model: str = "",
    ):
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.base_url = base_url or os.getenv("LLM_BASE_URL", "")
        self.model = model or os.getenv("LLM_MODEL", "")
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    async def async_chat(
        self,
        system: str,
        messages: list[dict],
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> str:
        all_messages = [{"role": "system", "content": system}] + messages
        resp = await self.client.chat.completions.create(
            model=self.model,
            messages=all_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content

    async def async_stream_chat(
        self,
        system: str,
        messages: list[dict],
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        all_messages = [{"role": "system", "content": system}] + messages
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=all_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
