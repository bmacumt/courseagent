"""Profile service: aggregate grading data + generate learning advice."""
import json
import logging
from collections import defaultdict
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Submission, Report, Assignment, User
from app.services.rag.llm_client import LLMClient

logger = logging.getLogger(__name__)

# In-memory cache: {student_id: {profile, advice, fingerprint}}
_profile_cache: dict[int, dict] = {}

ADVICE_SYSTEM_PROMPT = """你是一位隧道工程课程的学习顾问。根据学生历次作业的评分数据（知识整合、综合素养、创新思维、应用拓展、分析论证五个维度），给出个性化的学习建议。

要求：
1. 分析学生在五个维度上的优势和薄弱环节
2. 针对薄弱维度给出具体的改进建议
3. 根据成绩趋势给出鼓励或提醒
4. 建议不超过300字
5. 用鼓励但客观的语气"""


async def aggregate_student_profile(
    student_id: int,
    session: AsyncSession,
) -> dict:
    """Aggregate all grading data for a student into a profile."""
    # Query all graded submissions with reports
    result = await session.execute(
        select(Submission, Report, Assignment)
        .join(Report, Report.submission_id == Submission.id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .where(Submission.student_id == student_id, Submission.status == "graded")
        .order_by(Submission.submitted_at.asc())
    )
    rows = result.all()

    if not rows:
        return {
            "total_submissions": 0,
            "graded_submissions": 0,
            "average_score": 0.0,
            "score_trend": [],
            "dimension_averages": [],
            "weak_dimensions": [],
            "dimension_history": [],
        }

    from sqlalchemy import func
    total_sub = await session.scalar(
        select(func.count(Submission.id)).where(Submission.student_id == student_id)
    )

    dimension_scores = defaultdict(list)  # name -> [scores]
    dimension_labels = {}  # name -> label
    dimension_comments = defaultdict(list)  # name -> [comments]
    dimension_history = defaultdict(list)  # name -> [{date, score, title}]
    score_trend = []
    total_scores = []

    for sub, report, assignment in rows:
        total_scores.append(report.total_score)
        date_str = sub.submitted_at.strftime("%m-%d") if sub.submitted_at else ""
        score_trend.append({
            "date": date_str,
            "score": report.total_score,
            "assignment_title": assignment.title,
        })

        dims = json.loads(report.dimension_scores)
        for d in dims:
            name = d["name"]
            dimension_scores[name].append(d["score"])
            dimension_labels[name] = d["label"]
            if d.get("comment"):
                dimension_comments[name].append(d["comment"])
            dimension_history[name].append({
                "date": date_str,
                "score": d["score"],
                "assignment_title": assignment.title,
            })

    # Compute averages
    dimension_averages = []
    weak_dimensions = []
    for name in dimension_scores:
        scores = dimension_scores[name]
        avg = round(sum(scores) / len(scores), 1)
        comments = dimension_comments[name][-3:]  # last 3 comments
        dimension_averages.append({
            "name": name,
            "label": dimension_labels[name],
            "avg_score": avg,
            "count": len(scores),
            "comment_samples": comments,
        })
        if avg < 70:
            weak_dimensions.append({
                "name": name,
                "label": dimension_labels[name],
                "avg_score": avg,
            })

    # Sort by avg_score ascending so weak areas come first
    weak_dimensions.sort(key=lambda x: x["avg_score"])

    # Build dimension history
    dim_history_list = []
    for name in dimension_scores:
        dim_history_list.append({
            "name": name,
            "label": dimension_labels[name],
            "scores": dimension_history[name],
        })

    avg_score = round(sum(total_scores) / len(total_scores), 1) if total_scores else 0.0

    return {
        "total_submissions": total_sub or 0,
        "graded_submissions": len(rows),
        "average_score": avg_score,
        "score_trend": score_trend,
        "dimension_averages": dimension_averages,
        "weak_dimensions": weak_dimensions,
        "dimension_history": dim_history_list,
    }


async def generate_learning_advice(profile_data: dict) -> str:
    """Use LLM to generate personalized learning advice."""
    if not profile_data["dimension_averages"]:
        return "暂无评分数据，完成更多作业后即可生成学习建议。"

    dims_text = "\n".join(
        f"- {d['label']}：平均 {d['avg_score']} 分（{d['count']} 次评分）"
        for d in profile_data["dimension_averages"]
    )

    weak_text = ""
    if profile_data["weak_dimensions"]:
        weak_text = "\n\n薄弱维度：\n" + "\n".join(
            f"- {w['label']}：{w['avg_score']} 分"
            for w in profile_data["weak_dimensions"]
        )

    trend_text = ""
    if len(profile_data["score_trend"]) > 1:
        scores = [t["score"] for t in profile_data["score_trend"]]
        trend_text = f"\n\n成绩趋势：{' → '.join(str(s) for s in scores)}"

    user_msg = (
        f"学生已提交 {profile_data['graded_submissions']} 份作业，"
        f"平均分 {profile_data['average_score']}。\n\n"
        f"各维度表现：\n{dims_text}"
        f"{weak_text}{trend_text}"
    )

    llm = LLMClient()
    advice = await llm.async_chat(
        ADVICE_SYSTEM_PROMPT,
        [{"role": "user", "content": user_msg}],
        temperature=0.4,
        max_tokens=512,
    )
    return advice


async def _get_fingerprint(student_id: int, session: AsyncSession) -> tuple[int, str | None]:
    """Return (graded_count, latest_graded_at_iso) to detect data changes."""
    row = await session.execute(
        select(func.count(Submission.id), func.max(Submission.submitted_at))
        .join(Report, Report.submission_id == Submission.id)
        .where(Submission.student_id == student_id, Submission.status == "graded")
    )
    count, latest = row.one()
    return count, latest.isoformat() if latest else None


async def get_cached_profile(student_id: int, session: AsyncSession) -> tuple[dict, str]:
    """Return (profile_data, advice) with caching. Only recomputes when new grades exist."""
    fingerprint = await _get_fingerprint(student_id, session)
    cached = _profile_cache.get(student_id)

    if cached and cached["fingerprint"] == fingerprint:
        return cached["profile"], cached["advice"]

    profile = await aggregate_student_profile(student_id, session)
    advice = await generate_learning_advice(profile)
    _profile_cache[student_id] = {
        "profile": profile,
        "advice": advice,
        "fingerprint": fingerprint,
    }
    logger.info("Profile cache refreshed for student %s", student_id)
    return profile, advice


async def precompute_and_cache(student_id: int) -> None:
    """Fire-and-forget: precompute and cache profile after grading completes."""
    try:
        from app.db.engine import async_session
        async with async_session() as session:
            profile = await aggregate_student_profile(student_id, session)
            advice = await generate_learning_advice(profile)
            fp = await _get_fingerprint(student_id, session)
            _profile_cache[student_id] = {
                "profile": profile,
                "advice": advice,
                "fingerprint": fp,
            }
            logger.info("Profile precomputed for student %s", student_id)
    except Exception as e:
        logger.warning("Profile precompute failed for student %s: %s", student_id, e)


async def list_students_with_stats(
    session: AsyncSession,
    teacher_id: int | None = None,
) -> list[dict]:
    """List students with aggregated grading stats.
    If teacher_id is provided, only include students who submitted to that teacher's assignments.
    """
    # Base query: students with graded submissions
    if teacher_id:
        result = await session.execute(
            select(Submission.student_id, Report.total_score, Report.dimension_scores)
            .join(Report, Report.submission_id == Submission.id)
            .join(Assignment, Assignment.id == Submission.assignment_id)
            .where(Submission.status == "graded", Assignment.teacher_id == teacher_id)
        )
    else:
        result = await session.execute(
            select(Submission.student_id, Report.total_score, Report.dimension_scores)
            .join(Report, Report.submission_id == Submission.id)
            .where(Submission.status == "graded")
        )

    # Group by student
    student_data = defaultdict(lambda: {"scores": [], "dims": defaultdict(list), "dim_labels": {}})
    for student_id, score, dim_json in result.all():
        sd = student_data[student_id]
        sd["scores"].append(score)
        for d in json.loads(dim_json):
            sd["dims"][d["name"]].append(d["score"])
            sd["dim_labels"][d["name"]] = d["label"]

    # Build response
    students = []
    for sid, data in student_data.items():
        user = await session.get(User, sid)
        if not user or user.is_super:
            continue

        avg = round(sum(data["scores"]) / len(data["scores"]), 1) if data["scores"] else 0
        dim_avgs = []
        for name, scores in data["dims"].items():
            dim_avgs.append({
                "name": name,
                "label": data["dim_labels"][name],
                "avg_score": round(sum(scores) / len(scores), 1),
                "count": len(scores),
                "comment_samples": [],
            })

        students.append({
            "student_id": sid,
            "username": user.username,
            "real_name": user.real_name,
            "student_id_field": user.student_id,
            "class_name": user.class_name,
            "grade": user.grade,
            "submission_count": len(data["scores"]),
            "average_score": avg,
            "dimension_averages": dim_avgs,
        })

    students.sort(key=lambda x: x["average_score"], reverse=True)
    return students
