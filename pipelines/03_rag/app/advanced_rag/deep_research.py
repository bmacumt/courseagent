"""Deep research: iterative retrieval with sufficiency checking.

Adapted from ragflow/rag/advanced_rag/tree_structured_query_decomposition_retrieval.py
License: Apache 2.0 (original ragflow code)
"""
import asyncio
import logging
from typing import Callable, Awaitable

from app.core.llm_client import LLMClient
from app.prompts.generator import sufficiency_check, multi_queries_gen

logger = logging.getLogger(__name__)

RetrieverFunc = Callable[[str], Awaitable[list[dict]]]


class DeepResearch:
    """Iterative retrieval with sufficiency checking and query decomposition.

    For complex questions that span multiple documents, this class:
    1. Retrieves initial results
    2. Checks if information is sufficient
    3. If not, generates follow-up queries for missing information
    4. Recursively retrieves until sufficient or max depth reached
    """

    def __init__(
        self,
        retriever: RetrieverFunc,
        llm_client: LLMClient,
        max_depth: int = 3,
    ):
        self.retriever = retriever
        self.llm = llm_client
        self.max_depth = max_depth

    async def research(
        self,
        question: str,
        callback: Callable[[str], Awaitable[None]] | None = None,
    ) -> list[dict]:
        """Run deep research on a question.

        Args:
            question: The user's question
            callback: Optional async callback for progress updates

        Returns:
            List of chunk dicts with deduplication by chunk_id
        """
        collected: list[dict] = []
        seen_ids: set[str] = set()

        await self._research(
            question=question,
            query=question,
            collected=collected,
            seen_ids=seen_ids,
            depth=self.max_depth,
            callback=callback,
        )

        return collected

    async def _research(
        self,
        question: str,
        query: str,
        collected: list[dict],
        seen_ids: set[str],
        depth: int,
        callback=None,
    ):
        if depth == 0:
            return

        if callback:
            await callback(f"[深度检索] 搜索: {query}")

        # Retrieve
        try:
            chunks = await self.retriever(query)
        except Exception as e:
            logger.error(f"Retrieval error: {e}")
            return

        # Deduplicate and add
        new_chunks = []
        for c in chunks:
            cid = c.get("chunk_id", c.get("id", str(hash(c.get("content", "")))))
            if cid not in seen_ids:
                seen_ids.add(cid)
                collected.append(c)
                new_chunks.append(c)

        if callback:
            await callback(f"[深度检索] 获得新结果 {len(new_chunks)} 条")

        # Format retrieved content for sufficiency check
        ret_text = "\n".join(
            f"ID: {c.get('chunk_id', c.get('id', i))}\n{c.get('content', c.get('text', ''))}"
            for i, c in enumerate(collected)
        )

        # Check sufficiency
        suff = await sufficiency_check(self.llm, question, ret_text)

        if not suff:
            logger.warning("Sufficiency check returned empty, stopping")
            return

        if suff.get("is_sufficient"):
            if callback:
                await callback("[深度检索] 信息充足，结束检索")
            return

        # Generate follow-up queries
        missing = suff.get("missing_information", [])
        if callback:
            await callback(f"[深度检索] 信息不足，缺失: {', '.join(missing)}")

        follow_up = await multi_queries_gen(
            self.llm, question, query, missing, ret_text
        )

        questions = follow_up.get("questions", [])
        if not questions:
            return

        if callback:
            await callback(
                "[深度检索] 生成追问: " + ", ".join(q["question"] for q in questions)
            )

        # Recursively search for each follow-up query
        tasks = [
            self._research(
                question=question,
                query=q.get("query", q.get("question", "")),
                collected=collected,
                seen_ids=seen_ids,
                depth=depth - 1,
                callback=callback,
            )
            for q in questions
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
