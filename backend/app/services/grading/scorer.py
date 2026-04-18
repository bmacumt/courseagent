"""Dimension scorer: LLM-based scoring + regulation verification."""
import json
import logging
import os
import re

import json_repair
from jinja2 import Environment, FileSystemLoader

from app.services.grading.models import DimensionConfig, DimensionResult

logger = logging.getLogger(__name__)

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")
_jinja_env = Environment(loader=FileSystemLoader(PROMPTS_DIR))


def _render_prompt(template_name: str, **kwargs) -> str:
    tmpl = _jinja_env.get_template(template_name)
    return tmpl.render(**kwargs)


async def _call_llm_json(llm_client, system: str, user: str, max_tokens: int = 1024) -> dict:
    """Call LLM and parse JSON from response."""
    resp = await llm_client.async_chat(system, [{"role": "user", "content": user}], temperature=0.1, max_tokens=max_tokens)

    # Try to extract JSON from markdown code fence
    m = re.search(r"```(?:json)?\s*\n?(.*?)```", resp, re.DOTALL)
    text = m.group(1).strip() if m else resp.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json_repair.loads(text)


async def score_dimension(
    llm_client,
    dimension: DimensionConfig,
    question: str,
    student_answer: str,
    reference_answer: str | None = None,
    regulations: str | None = None,
    extra_instructions: str | None = None,
) -> DimensionResult:
    """Score a single dimension using LLM."""
    prompt = _render_prompt(
        "dimension_score.md",
        domain="隧道工程",
        label=dimension.label,
        description=dimension.description,
        question=question,
        student_answer=student_answer,
        reference_answer=reference_answer,
        regulations=regulations,
        extra_instructions=extra_instructions,
    )

    result = await _call_llm_json(
        llm_client,
        system="你是评分专家，严格按照指定维度评分，输出JSON。",
        user=prompt,
    )

    score = max(0, min(100, int(result.get("score", 0))))
    weighted = round(score * dimension.weight, 2)

    return DimensionResult(
        name=dimension.name,
        label=dimension.label,
        score=score,
        weight=dimension.weight,
        weighted_score=weighted,
        comment=result.get("comment", ""),
    )


async def check_regulations(
    llm_client,
    question: str,
    student_answer: str,
    regulations_text: str,
) -> dict:
    """Check if student answer cites the retrieved regulations."""
    prompt = _render_prompt(
        "regulation_check.md",
        question=question,
        student_answer=student_answer,
        regulations=regulations_text,
    )

    result = await _call_llm_json(
        llm_client,
        system="你是规范审查专家，检查学生答案是否引用了规范条文，输出JSON。",
        user=prompt,
    )

    return {
        "cited_regulations": result.get("cited_regulations", []),
        "uncited_regulations": result.get("uncited_regulations", []),
        "compliance_comment": result.get("compliance_comment", ""),
    }


async def generate_feedback(
    llm_client,
    question: str,
    student_answer: str,
    dimension_results: list[DimensionResult],
    total_score: float,
    max_score: int = 100,
    regulations_summary: str | None = None,
) -> str:
    """Generate overall feedback summary."""
    prompt = _render_prompt(
        "summary.md",
        question=question,
        student_answer=student_answer,
        dimensions=dimension_results,
        total_score=total_score,
        max_score=max_score,
        regulations_summary=regulations_summary,
    )

    return await llm_client.async_chat(
        "你是课程评语专家，生成鼓励但客观的综合评语。",
        [{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=512,
    )
