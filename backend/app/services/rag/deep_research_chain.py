"""Deep Research chain: iterative retrieval with sufficiency checking and query decomposition.

Inspired by ragflow's TreeStructuredQueryDecompositionRetrieval.
Flow: retrieve → sufficiency check → sub-query generation → recursive research → merge → answer.
"""
import asyncio
import json
import logging
import re
from typing import AsyncGenerator

from app.services.rag.llm_client import LLMClient
from app.services.rag.embedder import Embedder
from app.services.rag.reranker import Reranker
from app.services.rag.retriever import HybridRetriever
from app.services.rag.prompts.loader import render_prompt

logger = logging.getLogger(__name__)

DEEP_RESEARCH_SYSTEM_PROMPT = """你是课程智能助教（深度研究模式）。

你已获得经过多轮检索的丰富参考资料，请综合所有信息给出全面、准确的回答。

回答规则：
1. 优先基于参考资料回答，在回答中标注引用来源，格式为 [序号]
2. 如果参考资料不足以回答，但属于通用知识，可以直接回答
3. 如果问题超出参考资料范围且属于专业领域知识，先告知学生"以下内容不在知识库中，请注意甄别"，再根据自身知识作答
4. 回答要准确、专业、易于理解、条理清晰"""


def _extract_cited_indices(answer: str) -> set[int]:
    """Extract all [N] citation indices from the answer text."""
    return {int(m) for m in re.findall(r'\[(\d+)\]', answer)}


def _filter_sources_by_citation(sources: list[dict], answer: str) -> list[dict]:
    """Return only sources that are actually cited in the answer."""
    cited = _extract_cited_indices(answer)
    if not cited:
        return sources
    filtered = [s for s in sources if s["index"] in cited]
    for i, s in enumerate(filtered):
        s["index"] = i + 1
    return filtered


def _parse_json_response(text: str) -> dict | None:
    """Parse JSON from LLM response, handling markdown code fences."""
    cleaned = re.sub(r"```json\s*|```\s*$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


class DeepResearchChain:
    def __init__(
        self,
        retriever: HybridRetriever,
        embedder: Embedder,
        reranker: Reranker,
        llm: LLMClient,
        retrieve_top_k: int = 20,
        rerank_top_k: int = 5,
        max_depth: int = 2,
    ):
        self.retriever = retriever
        self.embedder = embedder
        self.reranker = reranker
        self.llm = llm
        self.retrieve_top_k = retrieve_top_k
        self.rerank_top_k = rerank_top_k
        self.max_depth = max_depth

    def _retrieve_and_rerank(self, query: str) -> list[dict]:
        """Retrieve + rerank, return list of source dicts."""
        results = self.retriever.retrieve(query, top_k=self.retrieve_top_k)
        if not results:
            return []
        doc_texts = [r["text"] for r in results]
        reranked = self.reranker.rerank(query, doc_texts, top_k=self.rerank_top_k)
        sources = []
        for r in reranked:
            idx = r["index"]
            sources.append({
                "text": results[idx]["text"],
                "metadata": results[idx].get("metadata", {}),
                "relevance_score": r["relevance_score"],
                "id": results[idx].get("id", ""),
            })
        return sources

    async def _check_sufficiency(self, question: str, context: str) -> dict:
        """Use LLM to check if retrieved context is sufficient for the question."""
        prompt = render_prompt(
            "sufficiency_check",
            question=question,
            retrieved_docs=context[:3000],
        )
        response = await self.llm.async_chat(
            system="You are a JSON output assistant. Output valid JSON only.",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=512,
        )
        result = _parse_json_response(response)
        if result is None:
            logger.warning(f"Failed to parse sufficiency response: {response[:200]}")
            return {"is_sufficient": True, "reasoning": "Parse error, assuming sufficient", "missing_information": []}
        return result

    async def _generate_sub_queries(
        self, question: str, query: str, missing_info: list[str], context: str
    ) -> list[dict]:
        """Generate complementary sub-queries for missing information."""
        prompt = render_prompt(
            "multi_queries_gen",
            original_question=question,
            original_query=query,
            retrieved_docs=context[:3000],
            missing_info="\n - ".join(missing_info) if missing_info else "N/A",
        )
        response = await self.llm.async_chat(
            system="You are a JSON output assistant. Output valid JSON only.",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=512,
        )
        result = _parse_json_response(response)
        if result is None:
            logger.warning(f"Failed to parse sub-query response: {response[:200]}")
            return []
        return result.get("questions", [])

    def _merge_sources(
        self, new_sources: list[dict], seen_ids: set[str], all_sources: list[dict]
    ) -> int:
        """Deduplicate and merge new sources. Returns count of new additions."""
        added = 0
        for s in new_sources:
            cid = s.get("id", "")
            if cid and cid not in seen_ids:
                seen_ids.add(cid)
                all_sources.append(s)
                added += 1
            elif not cid:
                all_sources.append(s)
                added += 1
        return added

    def _build_context(self, sources: list[dict], limit: int = 20) -> str:
        """Build numbered context string from sources."""
        parts = [f"[{i+1}] {s['text']}" for i, s in enumerate(sources[:limit])]
        return "\n\n".join(parts)

    async def _research(
        self,
        question: str,
        query: str,
        depth: int,
        seen_ids: set[str],
        all_sources: list[dict],
    ) -> AsyncGenerator[str, None]:
        """Recursively research a query. Yields SSE research_status events."""
        if depth <= 0:
            return

        yield f'event: research_status\ndata: {json.dumps({"phase": "searching", "query": query, "depth": depth}, ensure_ascii=False)}\n\n'

        sources = self._retrieve_and_rerank(query)
        new_count = self._merge_sources(sources, seen_ids, all_sources)
        logger.info(f"[deep_research] depth={depth}, query='{query[:50]}', +{new_count} new, total={len(all_sources)}")

        yield f'event: research_status\ndata: {json.dumps({"phase": "retrieved", "query": query, "new_chunks": new_count, "total_chunks": len(all_sources)}, ensure_ascii=False)}\n\n'

        context = self._build_context(all_sources)

        yield f'event: research_status\ndata: {json.dumps({"phase": "checking"}, ensure_ascii=False)}\n\n'
        sufficiency = await self._check_sufficiency(question, context)

        is_sufficient = sufficiency.get("is_sufficient", True)
        reasoning = sufficiency.get("reasoning", "")

        yield f'event: research_status\ndata: {json.dumps({"phase": "sufficiency", "sufficient": is_sufficient, "reasoning": reasoning}, ensure_ascii=False)}\n\n'

        if is_sufficient or depth <= 1:
            return

        missing = sufficiency.get("missing_information", [])
        if not missing:
            return

        sub_queries = await self._generate_sub_queries(question, query, missing, context)
        if not sub_queries:
            return

        sub_query_texts = [sq.get("question", "") for sq in sub_queries]
        yield f'event: research_status\ndata: {json.dumps({"phase": "sub_queries", "queries": sub_query_texts}, ensure_ascii=False)}\n\n'

        async def research_sub(sq: dict) -> list[str]:
            collected = []
            async for event in self._research(
                question,
                sq.get("query", sq.get("question", query)),
                depth - 1,
                seen_ids,
                all_sources,
            ):
                collected.append(event)
            return collected

        results = await asyncio.gather(
            *[research_sub(sq) for sq in sub_queries],
            return_exceptions=True,
        )

        for r in results:
            if isinstance(r, list):
                for event in r:
                    yield event

    async def stream_answer(self, question: str, history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        """Yield SSE events: research_status* -> tokens -> done (with sources)."""
        seen_ids: set[str] = set()
        all_sources: list[dict] = []

        yield f'event: research_status\ndata: {json.dumps({"phase": "start", "max_depth": self.max_depth}, ensure_ascii=False)}\n\n'

        async for event in self._research(question, question, self.max_depth, seen_ids, all_sources):
            yield event

        if not all_sources:
            yield f'event: done\ndata: {json.dumps({"answer": "抱歉，经过多轮检索仍未找到与您的问题相关的参考资料。"})}\n\n'
            return

        # Sort by relevance and limit
        all_sources.sort(key=lambda s: s.get("relevance_score", 0), reverse=True)
        final_sources = all_sources[:20]

        # Re-index
        for i, s in enumerate(final_sources):
            s["index"] = i + 1

        context = self._build_context(final_sources)
        user_msg = f"参考资料：\n{context}\n\n问题：{question}"
        messages = (history or []) + [{"role": "user", "content": user_msg}]

        full_answer = ""
        async for token in self.llm.async_stream_chat(
            DEEP_RESEARCH_SYSTEM_PROMPT, messages
        ):
            full_answer += token
            yield f'event: token\ndata: {json.dumps({"content": token})}\n\n'

        # Filter sources by actual citations in the answer
        cited_sources = _filter_sources_by_citation(final_sources, full_answer)

        yield f"event: done\ndata: {json.dumps({'sources': cited_sources})}\n\n"

    async def answer(self, question: str, history: list[dict] | None = None) -> dict:
        """Non-streaming deep research answer."""
        seen_ids: set[str] = set()
        all_sources: list[dict] = []

        async for _ in self._research(question, question, self.max_depth, seen_ids, all_sources):
            pass

        if not all_sources:
            return {
                "question": question,
                "answer": "抱歉，经过多轮检索仍未找到与您的问题相关的参考资料。",
                "sources": [],
                "num_retrieved": 0,
                "num_reranked": 0,
            }

        all_sources.sort(key=lambda s: s.get("relevance_score", 0), reverse=True)
        final_sources = all_sources[:20]
        for i, s in enumerate(final_sources):
            s["index"] = i + 1

        context = self._build_context(final_sources)
        user_msg = f"参考资料：\n{context}\n\n问题：{question}"
        messages = (history or []) + [{"role": "user", "content": user_msg}]

        answer_text = await self.llm.async_chat(
            DEEP_RESEARCH_SYSTEM_PROMPT, messages
        )

        return {
            "question": question,
            "answer": answer_text,
            "sources": final_sources,
            "num_retrieved": len(seen_ids),
            "num_reranked": len(final_sources),
        }
