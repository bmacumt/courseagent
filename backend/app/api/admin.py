"""Admin routes: user management, system stats, settings, data browsing."""
import json
import os
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_role
from app.auth.jwt import hash_password
from app.db.engine import get_session
from app.db.models import User, Document, Assignment, Submission, Report, Setting
from app.api.schemas import (
    CreateUserRequest, UpdateUserRequest, UserResponse,
    BatchStudentRequest, BatchImportResult,
    SystemStats, SettingItem, SettingUpdate,
    AssignmentSummary, SubmissionSummary, SubmissionDetail, ReportResponse, DimensionScoreItem,
)

router = APIRouter(prefix="/admin", tags=["admin"])
require_admin = require_role("admin")


@router.post("/users", response_model=UserResponse)
async def create_user(
    req: CreateUserRequest,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    existing = await session.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    if req.student_id:
        dup = await session.execute(select(User).where(User.student_id == req.student_id))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Student ID already exists")

    user = User(
        username=req.username,
        password_hash="",
        role=req.role,
        is_registered=False,
        real_name=req.real_name,
        student_id=req.student_id,
        class_name=req.class_name,
        email=req.email,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/users/batch", response_model=BatchImportResult)
async def batch_import_students(
    req: BatchStudentRequest,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    success_count = 0
    failed = []
    created_ids = []

    for i, s in enumerate(req.students):
        try:
            existing = await session.execute(select(User).where(User.username == s.username))
            if existing.scalar_one_or_none():
                failed.append({"index": i, "username": s.username, "reason": "username exists"})
                continue

            dup = await session.execute(select(User).where(User.student_id == s.student_id))
            if dup.scalar_one_or_none():
                failed.append({"index": i, "username": s.username, "reason": "student_id exists"})
                continue

            user = User(
                username=s.username,
                password_hash="",
                role="student",
                is_registered=False,
                real_name=s.real_name,
                student_id=s.student_id,
                class_name=s.class_name,
            )
            session.add(user)
            await session.flush()
            created_ids.append(user.id)
            success_count += 1
        except Exception as e:
            failed.append({"index": i, "username": s.username, "reason": str(e)})

    await session.commit()
    return BatchImportResult(success_count=success_count, failed=failed, created_ids=created_ids)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    role: str | None = None,
    class_name: str | None = None,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(User).where(User.is_super == False)
    if role:
        stmt = stmt.where(User.role == role)
    if class_name:
        stmt = stmt.where(User.class_name == class_name)
    result = await session.execute(stmt.order_by(User.id))
    return result.scalars().all()


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    req: UpdateUserRequest,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.real_name is not None:
        user.real_name = req.real_name
    if req.class_name is not None:
        user.class_name = req.class_name
    if req.password is not None:
        user.password_hash = hash_password(req.password)

    await session.commit()
    await session.refresh(user)
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await session.delete(user)
    await session.commit()
    return {"status": "deleted"}


@router.get("/stats", response_model=SystemStats)
async def system_stats(
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    users = await session.scalar(select(func.count(User.id)).where(User.is_super == False))
    docs = await session.scalar(select(func.count(Document.id)))
    assignments = await session.scalar(select(func.count(Assignment.id)))
    submissions = await session.scalar(select(func.count(Submission.id)))
    return SystemStats(
        total_users=users or 0,
        total_documents=docs or 0,
        total_assignments=assignments or 0,
        total_submissions=submissions or 0,
    )


# --- Settings (Phase 5 merged) ---

@router.get("/settings")
async def list_settings(
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Setting).order_by(Setting.category, Setting.key))
    settings = result.scalars().all()

    grouped: dict[str, list[dict]] = defaultdict(list)
    for s in settings:
        grouped[s.category].append(SettingItem.model_validate(s).model_dump())
    return dict(grouped)


@router.put("/settings/{key}", response_model=SettingItem)
async def update_setting(
    key: str,
    req: SettingUpdate,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        from app.services.settings_service import DEFAULTS
        category = next((c for c, k, _ in DEFAULTS if k == key), "general")
        setting = Setting(key=key, value=req.value, category=category)
        session.add(setting)
    else:
        setting.value = req.value

    await session.commit()
    await session.refresh(setting)

    from app.services.settings_service import sync_to_env
    sync_to_env(key, req.value)

    return setting


# --- Data Browsing (read-only admin view) ---

@router.get("/knowledge")
async def list_all_documents(
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Document).order_by(Document.uploaded_at.desc())
    )
    docs = result.scalars().all()
    out = []
    for d in docs:
        owner = await session.get(User, d.owner_id)
        out.append({
            "id": d.id, "doc_uuid": d.doc_uuid, "filename": d.filename,
            "title": d.title, "doc_type": d.doc_type, "owner_id": d.owner_id,
            "owner_name": owner.real_name or owner.username if owner else None,
            "chunk_count": d.chunk_count, "parse_status": d.parse_status,
            "uploaded_at": d.uploaded_at,
        })
    return out


@router.get("/knowledge/{doc_id}/chunks")
async def admin_get_chunks(
    doc_id: int,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    doc = await session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    from app.services.rag_service import RAGService
    rag = RAGService()
    chunks = rag.manager.vector_store.get_chunks_by_doc(doc.doc_uuid)
    return {"chunks": chunks}


@router.get("/assignments", response_model=list[AssignmentSummary])
async def list_all_assignments(
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Assignment).order_by(Assignment.created_at.desc())
    )
    assignments = result.scalars().all()
    summaries = []
    for a in assignments:
        count = await session.scalar(
            select(func.count(Submission.id)).where(Submission.assignment_id == a.id)
        )
        summaries.append(AssignmentSummary(
            id=a.id, title=a.title, is_published=a.is_published,
            deadline=a.deadline, created_at=a.created_at,
            submission_count=count or 0,
        ))
    return summaries


@router.get("/assignments/{assignment_id}/submissions", response_model=list[SubmissionSummary])
async def admin_list_submissions(
    assignment_id: int,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    assignment = await session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    result = await session.execute(
        select(Submission)
        .where(Submission.assignment_id == assignment_id)
        .order_by(Submission.submitted_at.desc())
    )
    submissions = result.scalars().all()

    summaries = []
    for s in submissions:
        report = await session.scalar(select(Report).where(Report.submission_id == s.id))
        student = await session.get(User, s.student_id)
        summaries.append(SubmissionSummary(
            id=s.id, assignment_id=s.assignment_id,
            student_name=student.username if student else None,
            student_real_name=student.real_name if student else None,
            student_id_field=student.student_id if student else None,
            class_name=student.class_name if student else None,
            status=s.status, submitted_at=s.submitted_at,
            total_score=report.total_score if report else None,
            has_attachment=s.attachment_path is not None,
            attachment_filename=os.path.basename(s.attachment_path).split("_", 1)[-1] if s.attachment_path else None,
            report_id=report.id if report else None,
        ))
    return summaries


@router.get("/submissions/{submission_id}", response_model=SubmissionDetail)
async def admin_get_submission(
    submission_id: int,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    student = await session.get(User, submission.student_id)
    return SubmissionDetail(
        id=submission.id, assignment_id=submission.assignment_id,
        student_name=student.username if student else None,
        student_real_name=student.real_name if student else None,
        student_id_field=student.student_id if student else None,
        class_name=student.class_name if student else None,
        content=submission.content,
        has_attachment=submission.attachment_path is not None,
        attachment_filename=os.path.basename(submission.attachment_path).split("_", 1)[-1] if submission.attachment_path else None,
        status=submission.status, submitted_at=submission.submitted_at,
    )


@router.get("/submissions/{submission_id}/attachment")
async def admin_download_attachment(
    submission_id: int,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    submission = await session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not submission.attachment_path or not os.path.exists(submission.attachment_path):
        raise HTTPException(status_code=404, detail="No attachment found")

    filename = os.path.basename(submission.attachment_path).split("_", 1)[-1]
    student = await session.get(User, submission.student_id)
    display_name = f"{student.student_id or student.username}_{student.real_name or student.username}_{filename}" if student else filename
    from urllib.parse import quote
    encoded = quote(display_name)
    ascii_name = display_name.encode("ascii", errors="replace").decode()
    return FileResponse(
        submission.attachment_path,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"},
    )


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def admin_get_report(
    report_id: int,
    current_user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    report = await session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    submission = await session.get(Submission, report.submission_id)
    assignment = None
    student = None
    if submission:
        assignment = await session.get(Assignment, submission.assignment_id)
        student = await session.get(User, submission.student_id)

    dims = []
    for d in json.loads(report.dimension_scores):
        dims.append(DimensionScoreItem(**d))
    return ReportResponse(
        id=report.id, submission_id=report.submission_id,
        total_score=report.total_score, max_score=report.max_score,
        dimension_scores=dims, feedback=report.feedback,
        references=json.loads(report.references),
        regulations_found=json.loads(report.regulations_found),
        regulations_cited=json.loads(report.regulations_cited),
        created_at=report.created_at,
        student_real_name=student.real_name if student else None,
        assignment_title=assignment.title if assignment else None,
    )
