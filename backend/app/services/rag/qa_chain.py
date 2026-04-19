"""QA chain: retrieve -> rerank -> generate answer with citations."""
import json
import logging
import re
from typing import AsyncGenerator

from app.services.rag.llm_client import LLMClient
from app.services.rag.embedder import Embedder
from app.services.rag.reranker import Reranker
from app.services.rag.retriever import HybridRetriever

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是课程智能助教。

回答规则：
1. 优先基于参考资料回答，在回答中标注引用来源，格式为 [序号]
2. 如果参考资料不足以回答，但属于通用知识（数学公式、编程语法、常识等），可以直接回答
3. 如果问题超出参考资料范围且属于专业领域知识，先告知学生"以下内容不在知识库中，请注意甄别"，再根据自身知识作答
4. 回答要准确、专业、易于理解"""


def _extract_cited_indices(answer: str) -> set[int]:
    """Extract all [N] citation indices from the answer text."""
    return {int(m) for m in re.findall(r'\[(\d+)\]', answer)}


def _filter_sources_by_citation(sources: list[dict], answer: str) -> list[dict]:
    """Return only sources that are actually cited in the answer."""
    cited = _extract_cited_indices(answer)
    if not cited:
        return sources
    filtered = [s for s in sources if s["index"] in cited]
    # Re-index filtered sources to 1..N
    for i, s in enumerate(filtered):
        s["index"] = i + 1
    return filtered


class QAChain:
    def __init__(
        self,
        retriever: HybridRetriever,
        embedder: Embedder,
        reranker: Reranker,
        llm: LLMClient,
        retrieve_top_k: int = 20,
        rerank_top_k: int = 5,
    ):
        self.retriever = retriever
        self.embedder = embedder
        self.reranker = reranker
        self.llm = llm
        self.retrieve_top_k = retrieve_top_k
        self.rerank_top_k = rerank_top_k

    def _retrieve_context(self, question: str) -> tuple[str, list[dict], int, int]:
        """Retrieve + rerank, return (context, sources, num_retrieved, num_reranked)."""
        results = self.retriever.retrieve(question, top_k=self.retrieve_top_k)
        logger.info(f"Retrieved {len(results)} chunks for: {question[:50]}")

        if not results:
            return "", [], 0, 0

        doc_texts = [r["text"] for r in results]
        reranked = self.reranker.rerank(question, doc_texts, top_k=self.rerank_top_k)

        sources = []
        for i, r in enumerate(reranked):
            idx = r["index"]
            sources.append({
                "index": i + 1,
                "text": results[idx]["text"],
                "metadata": results[idx].get("metadata", {}),
                "relevance_score": r["relevance_score"],
            })

        context_parts = [f"[{s['index']}] {s['text']}" for s in sources]
        context = "\n\n".join(context_parts)
        return context, sources, len(results), len(reranked)

    async def answer(self, question: str, history: list[dict] | None = None) -> dict:
        context, sources, num_retrieved, num_reranked = self._retrieve_context(question)

        if not sources:
            return {
                "question": question,
                "answer": "抱歉，未找到与您的问题相关的参考资料。",
                "sources": [],
                "num_retrieved": 0,
                "num_reranked": 0,
            }

        user_msg = f"参考资料：\n{context}\n\n问题：{question}"
        messages = (history or []) + [{"role": "user", "content": user_msg}]
        answer = await self.llm.async_chat(SYSTEM_PROMPT, messages)

        cited_sources = _filter_sources_by_citation(sources, answer)

        return {
            "question": question,
            "answer": answer,
            "sources": cited_sources,
            "num_retrieved": num_retrieved,
            "num_reranked": num_reranked,
        }

    async def stream_answer(self, question: str, history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        """Yield SSE events: sources -> tokens -> done.

        Sources are sent AFTER tokens so we can filter by actual citations.
        Frontend receives: tokens -> done (with sources in done event).
        """
        context, sources, num_retrieved, num_reranked = self._retrieve_context(question)

        if not sources:
            yield f"event: done\ndata: {json.dumps({'answer': '抱歉，未找到与您的问题相关的参考资料。'})}\n\n"
            return

        user_msg = f"参考资料：\n{context}\n\n问题：{question}"
        messages = (history or []) + [{"role": "user", "content": user_msg}]

        full_answer = ""
        async for token in self.llm.async_stream_chat(SYSTEM_PROMPT, messages):
            full_answer += token
            yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

        # Filter sources by actual citations in the answer
        cited_sources = _filter_sources_by_citation(sources, full_answer)

        yield f"event: done\ndata: {json.dumps({'sources': cited_sources})}\n\n"
