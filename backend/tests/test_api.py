"""05_backend MVP test: full integration test for business APIs."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from fastapi.testclient import TestClient

from app.auth.jwt import create_access_token, decode_access_token, hash_password, verify_password
from app.db.engine import async_session, init_db, engine
from app.db.models import Base, User, Assignment, Submission, Report, Document, Setting
from app.main import app

import asyncio
from sqlalchemy import select, text


# --- Setup ---

def setup_db(db_path: str):
    """Override DATABASE_PATH and reinitialize."""
    import app.config as cfg
    cfg.DATABASE_PATH = db_path

    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    new_engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", echo=False)
    new_session = async_sessionmaker(new_engine, class_=AsyncSession, expire_on_commit=False)

    import app.db.engine as eng
    eng.engine = new_engine
    eng.async_session = new_session

    # Override get_session dependency
    from app.db.engine import get_session

    async def _init():
        async with new_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Seed users
        async with new_session() as s:
            users = [
                User(username="admin", password_hash=hash_password("admin123"), role="admin", real_name="管理员"),
                User(username="teacher1", password_hash=hash_password("teacher123"), role="teacher", real_name="张老师"),
                User(username="teacher2", password_hash=hash_password("teacher123"), role="teacher", real_name="李老师"),
                User(username="student1", password_hash=hash_password("student123"), role="student",
                     real_name="王同学", student_id="2024001", class_name="隧道一班"),
            ]
            for u in users:
                s.add(u)
            await s.commit()

    asyncio.run(_init())
    return new_session


def get_headers(username: str, role: str) -> dict:
    token = create_access_token(data={"sub": username, "role": role})
    return {"Authorization": f"Bearer {token}"}


# --- Tests ---

def test_health(client):
    print("\n=== Test: Health Check ===")
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    print("  ✅ Health check passed")


def test_login(client):
    print("\n=== Test: Login ===")

    # Success
    resp = client.post("/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    print("  ✅ Login success")

    # Wrong password
    resp = client.post("/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401
    print("  ✅ Wrong password rejected")


def test_me(client):
    print("\n=== Test: GET /me ===")
    headers = get_headers("admin", "admin")
    resp = client.get("/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["real_name"] == "管理员"
    print(f"  ✅ /me returned: {data['username']} ({data['role']}) real_name={data['real_name']}")


def test_admin_create_user(client):
    print("\n=== Test: Admin Create User ===")
    headers = get_headers("admin", "admin")

    # Create teacher
    resp = client.post("/admin/users", headers=headers, json={
        "username": "teacher3", "password": "pass123", "role": "teacher", "real_name": "赵老师"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "teacher"
    assert data["real_name"] == "赵老师"
    print(f"  ✅ Created teacher: {data['username']}")

    # Duplicate username
    resp = client.post("/admin/users", headers=headers, json={
        "username": "teacher3", "password": "pass456", "role": "teacher"
    })
    assert resp.status_code == 400
    print("  ✅ Duplicate username rejected")


def test_admin_batch_import(client):
    print("\n=== Test: Admin Batch Import Students ===")
    headers = get_headers("admin", "admin")

    resp = client.post("/admin/users/batch", headers=headers, json={
        "students": [
            {"username": "stu_a", "password": "123456", "real_name": "学生A", "student_id": "S001", "class_name": "隧道一班"},
            {"username": "stu_b", "password": "123456", "real_name": "学生B", "student_id": "S002", "class_name": "隧道一班"},
            {"username": "stu_c", "password": "123456", "real_name": "学生C", "student_id": "S003", "class_name": "隧道二班"},
        ]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success_count"] == 3
    assert len(data["failed"]) == 0
    print(f"  ✅ Imported {data['success_count']} students")


def test_admin_list_students(client):
    print("\n=== Test: Admin List Students ===")
    headers = get_headers("admin", "admin")

    resp = client.get("/admin/users?role=student", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 4  # 1 from seed + 3 from batch
    print(f"  ✅ Listed {len(data)} students")

    # Filter by class
    resp = client.get("/admin/users?role=student&class_name=隧道一班", headers=headers)
    data = resp.json()
    print(f"  ✅ 隧道一班: {len(data)} students")


def test_admin_duplicate_student_id(client):
    print("\n=== Test: Duplicate Student ID ===")
    headers = get_headers("admin", "admin")

    resp = client.post("/admin/users", headers=headers, json={
        "username": "stu_d", "password": "123456", "role": "student",
        "student_id": "S001",  # already exists from batch
    })
    assert resp.status_code == 400
    print("  ✅ Duplicate student_id rejected")


def test_teacher_cannot_access_admin(client):
    print("\n=== Test: Teacher Cannot Access Admin ===")
    headers = get_headers("teacher1", "teacher")

    resp = client.get("/admin/users", headers=headers)
    assert resp.status_code == 403
    print("  ✅ Teacher got 403 on admin endpoint")


def test_teacher_assignment_crud(client):
    print("\n=== Test: Teacher Assignment CRUD ===")
    headers = get_headers("teacher1", "teacher")

    # Create
    resp = client.post("/teacher/assignments", headers=headers, json={
        "title": "公路工程标准体系概述",
        "description": "请阐述公路工程标准体系的总体框架结构",
        "question": "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。",
        "deadline": None,
    })
    assert resp.status_code == 200
    assignment = resp.json()
    assert assignment["title"] == "公路工程标准体系概述"
    assert assignment["is_published"] == False
    print(f"  ✅ Created assignment id={assignment['id']}")

    # List
    resp = client.get("/teacher/assignments", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    print(f"  ✅ Listed {len(data)} assignments")

    # Publish
    resp = client.put(f"/teacher/assignments/{assignment['id']}/publish", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_published"] == True
    print("  ✅ Published assignment")

    # Cannot edit published
    resp = client.put(f"/teacher/assignments/{assignment['id']}", headers=headers, json={
        "title": "修改标题"
    })
    assert resp.status_code == 400
    print("  ✅ Cannot edit published assignment")

    return assignment


def test_student_sees_published(client, assignment):
    print("\n=== Test: Student Sees Published Assignments ===")
    headers = get_headers("student1", "student")

    resp = client.get("/student/assignments", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["title"] == "公路工程标准体系概述"
    assert data[0]["has_submitted"] == False
    print(f"  ✅ Student sees {len(data)} published assignments")


def test_student_submit(client, assignment):
    print("\n=== Test: Student Submit Answer ===")
    headers = get_headers("student1", "student")

    resp = client.post(f"/student/assignments/{assignment['id']}/submit", headers=headers, data={
        "content": "公路工程标准体系采用三层结构：板块、模块和标准。体系共分为六大板块。"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "submitted"
    submission_id = data["id"]
    print(f"  ✅ Submitted, id={submission_id}")

    # Resubmit (should create new record)
    resp = client.post(f"/student/assignments/{assignment['id']}/submit", headers=headers, data={
        "content": "公路工程标准体系（JTG 1001-2017）采用三层结构：板块、模块和标准。体系共分为六大板块：总体、通用、公路建设、公路管理、公路养护、公路运营。"
    })
    assert resp.status_code == 200
    data2 = resp.json()
    assert data2["id"] != submission_id
    print(f"  ✅ Resubmitted, new id={data2['id']} (old id={submission_id} preserved)")

    return data2["id"]


def test_student_submissions_list(client):
    print("\n=== Test: Student Submissions List ===")
    headers = get_headers("student1", "student")

    resp = client.get("/student/submissions", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2  # original + resubmit
    print(f"  ✅ Student has {len(data)} submissions")


def test_isolation_student_cannot_see_others(client):
    print("\n=== Test: Isolation — Student Cannot See Others ===")
    headers = get_headers("student1", "student")

    resp = client.get("/student/submissions", headers=headers)
    data = resp.json()

    # All submissions belong to student1
    for s in data:
        assert "student1" in s.get("student_name", "")
    print(f"  ✅ Student only sees own {len(data)} submissions")


def test_isolation_teacher_cannot_see_others(client):
    print("\n=== Test: Isolation — Teacher Cannot See Others' Data ===")
    headers1 = get_headers("teacher1", "teacher")
    headers2 = get_headers("teacher2", "teacher")

    # Teacher1's assignments
    resp1 = client.get("/teacher/assignments", headers=headers1)
    data1 = resp1.json()

    # Teacher2's assignments (should be empty)
    resp2 = client.get("/teacher/assignments", headers=headers2)
    data2 = resp2.json()
    assert len(data2) == 0
    print(f"  ✅ Teacher2 sees 0 assignments (teacher1 has {len(data1)})")

    # Teacher2 tries to view teacher1's submissions
    if data1:
        aid = data1[0]["id"]
        resp = client.get(f"/teacher/assignments/{aid}/submissions", headers=headers2)
        assert resp.status_code == 404
        print("  ✅ Teacher2 cannot access teacher1's assignment submissions")


def test_teacher_view_submissions(client, assignment):
    print("\n=== Test: Teacher View Submissions ===")
    headers = get_headers("teacher1", "teacher")

    resp = client.get(f"/teacher/assignments/{assignment['id']}/submissions", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    print(f"  ✅ Teacher sees {len(data)} submissions")

    for s in data:
        print(f"     {s['student_name']} ({s['student_real_name']}): status={s['status']}")


def test_admin_stats(client):
    print("\n=== Test: Admin Stats ===")
    headers = get_headers("admin", "admin")

    resp = client.get("/admin/stats", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    print(f"  ✅ Stats: users={data['total_users']}, docs={data['total_documents']}, "
          f"assignments={data['total_assignments']}, submissions={data['total_submissions']}")


def test_admin_settings_crud(client):
    print("\n=== Test: Admin Settings CRUD ===")
    headers = get_headers("admin", "admin")

    # Create
    resp = client.put("/admin/settings/llm_model", headers=headers, json={"value": "deepseek-chat"})
    assert resp.status_code == 200
    assert resp.json()["value"] == "deepseek-chat"
    print("  ✅ Created setting")

    # List
    resp = client.get("/admin/settings", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "general" in data or len(data) >= 1
    print(f"  ✅ Settings categories: {list(data.keys())}")

    # Update
    resp = client.put("/admin/settings/llm_model", headers=headers, json={"value": "deepseek-v3"})
    assert resp.status_code == 200
    assert resp.json()["value"] == "deepseek-v3"
    print("  ✅ Updated setting")


# --- Main ---

def main():
    print("=== 05_backend MVP Test ===\n")

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test.db")
        session_factory = setup_db(db_path)

        # Override get_session dependency to use our test session factory
        from app.db.engine import get_session as _orig_get_session

        async def _test_get_session():
            from app.db.engine import async_session
            async with async_session() as session:
                yield session

        from app.main import app
        from app.db.engine import get_session
        app.dependency_overrides[get_session] = _test_get_session

        client = TestClient(app)

        # Run tests
        test_health(client)
        test_login(client)
        test_me(client)

        test_admin_create_user(client)
        test_admin_batch_import(client)
        test_admin_list_students(client)
        test_admin_duplicate_student_id(client)
        test_teacher_cannot_access_admin(client)

        assignment = test_teacher_assignment_crud(client)
        test_student_sees_published(client, assignment)

        submission_id = test_student_submit(client, assignment)
        test_student_submissions_list(client)

        test_isolation_student_cannot_see_others(client)
        test_isolation_teacher_cannot_see_others(client)

        test_teacher_view_submissions(client, assignment)
        test_admin_stats(client)
        test_admin_settings_crud(client)
        test_student_submit_empty(client, assignment)
        test_teacher_export_csv(client, assignment)

def test_student_submit_empty(client, assignment):
    print("\n=== Test: Student Submit Empty (400) ===")
    headers = get_headers("student1", "student")
    resp = client.post(f"/student/assignments/{assignment['id']}/submit", headers=headers)
    assert resp.status_code == 400
    assert "Must provide" in resp.json()["detail"]
    print("  ✅ Empty submit rejected with 400")


def test_teacher_export_csv(client, assignment):
    print("\n=== Test: Teacher Export CSV ===")
    headers = get_headers("teacher1", "teacher")
    resp = client.get(f"/teacher/assignments/{assignment['id']}/export", headers=headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    raw = resp.content.decode("utf-8-sig")
    assert "学号" in raw
    assert "总分" in raw
    lines = raw.strip().split("\n")
    assert len(lines) >= 2  # header + at least 1 data row
    print(f"  ✅ CSV exported, {len(lines)} lines")


    print("\n✅ All 05_backend tests passed!")


if __name__ == "__main__":
    main()
