"""LLM-powered prompt generators for RAG enhancement.

Adapted from ragflow/rag/prompts/generator.py
License: Apache 2.0 (original ragflow code)
"""
import json
import logging
import re

from app.core.token_utils import num_tokens_from_string
from app.prompts.loader import render_prompt

logger = logging.getLogger(__name__)


def message_fit_in(msg: list[dict], max_length: int = 4000) -> tuple[int, list[dict]]:
    """Trim message list to fit within token limit, keeping system + last message."""
    def count():
        return sum(num_tokens_from_string(m["content"]) for m in msg)

    c = count()
    if c < max_length:
        return c, msg

    msg_ = [m for m in msg if m["role"] == "system"]
    if len(msg) > 1:
        msg_.append(msg[-1])
    msg = msg_
    c = count()
    if c < max_length:
        return c, msg

    ll = num_tokens_from_string(msg_[0]["content"])
    ll2 = num_tokens_from_string(msg_[-1]["content"])
    if ll / (ll + ll2) > 0.8:
        from app.core.token_utils import truncate
        msg[0]["content"] = truncate(msg_[0]["content"], max_length - ll2)
        return max_length, msg

    msg[-1]["content"] = truncate(msg_[-1]["content"], max_length - ll)
    return count(), msg


async def _gen_json(llm_client, system_prompt: str, user_prompt: str, max_retry: int = 2) -> dict:
    """Call LLM and parse JSON response."""
    msg = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    ans = ""
    err = ""
    for _ in range(max_retry):
        if ans and err:
            msg[-1]["content"] += (
                f"\nGenerated JSON:\n{ans}\nBut error:\n{err}\nPlease fix."
            )
        resp = await llm_client.async_chat(
            system=msg[0]["content"],
            messages=msg[1:],
            temperature=0.2,
        )
        # Strip markdown code fences and preamble before JSON
        ans = resp.strip()
        # Remove ```json ... ``` wrapping
        m = re.search(r"```(?:json)?\s*\n?(.*?)```", ans, re.DOTALL)
        if m:
            ans = m.group(1).strip()
        else:
            # Try to find JSON object/array directly
            m = re.search(r"(\{.*\}|\[.*\])", ans, re.DOTALL)
            if m:
                ans = m.group(1).strip()
        try:
            return json.loads(ans)
        except json.JSONDecodeError:
            try:
                import json_repair
                return json_repair.loads(ans)
            except Exception:
                pass
            err = f"Invalid JSON: {ans[:100]}"
    return {}


async def keyword_extraction(llm_client, content: str, topn: int = 3) -> str:
    """Extract keywords from text content."""
    prompt = render_prompt("keyword_extraction", content=content, topn=topn)
    resp = await llm_client.async_chat(
        system=prompt,
        messages=[{"role": "user", "content": "Output: "}],
        temperature=0.2,
    )
    resp = re.sub(r"^.*?\n", "", resp, flags=re.DOTALL)
    if "**ERROR**" in resp:
        return ""
    return resp


async def question_proposal(llm_client, content: str, topn: int = 3) -> str:
    """Generate questions from text content."""
    prompt = render_prompt("question_generation", content=content, topn=topn)
    resp = await llm_client.async_chat(
        system=prompt,
        messages=[{"role": "user", "content": "Output: "}],
        temperature=0.2,
    )
    resp = re.sub(r"^.*?\n", "", resp, flags=re.DOTALL)
    if "**ERROR**" in resp:
        return ""
    return resp


async def sufficiency_check(llm_client, question: str, retrieved_docs: str) -> dict:
    """Check if retrieved content is sufficient to answer the question."""
    return await _gen_json(
        llm_client,
        render_prompt("sufficiency_check", question=question, retrieved_docs=retrieved_docs),
        "Output:\n",
    )


async def multi_queries_gen(
    llm_client,
    question: str,
    query: str,
    missing_infos: list[str],
    retrieved_docs: str,
) -> dict:
    """Generate complementary queries for missing information."""
    return await _gen_json(
        llm_client,
        render_prompt(
            "multi_queries_gen",
            original_question=question,
            original_query=query,
            missing_info="\n - ".join(missing_infos),
            retrieved_docs=retrieved_docs,
        ),
        "Output:\n",
    )
