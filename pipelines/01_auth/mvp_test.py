"""01_auth MVP test: password hashing, JWT, login/me endpoints, role-based access.

Uses FastAPI TestClient — no server needed.
Database is in-memory for test isolation.
"""
import os
import sys
import tempfile

# Set test database path before importing app modules
_test_db = tempfile.mktemp(suffix=".db")
os.environ["DATABASE_PATH"] = _test_db
os.environ["SECRET_KEY"] = "test-secret-key-for-mvp"

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

# Now import app modules (they read DATABASE_PATH from env)
from app.auth import create_access_token, decode_access_token, hash_password, verify_password
from app.database import async_session, engine, init_db
from app.models import Base, User
from app.main import app

from fastapi.testclient import TestClient


# --- Seed helpers ---

async def seed_users():
    async with async_session() as session:
        users = [
            User(username="admin", password_hash=hash_password("admin123"), role="admin"),
            User(username="teacher1", password_hash=hash_password("teacher123"), role="teacher"),
            User(username="student1", password_hash=hash_password("student123"), role="student"),
        ]
        session.add_all(users)
        await session.commit()


async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await seed_users()


# --- Tests ---

def test_password_hashing():
    print("test_password_hashing...", end=" ")
    hashed = hash_password("mypassword")
    assert hashed != "mypassword"
    assert verify_password("mypassword", hashed)
    assert not verify_password("wrongpassword", hashed)
    print("OK")


def test_jwt_token():
    print("test_jwt_token...", end=" ")
    token = create_access_token(data={"sub": "testuser", "role": "admin"})
    payload = decode_access_token(token)
    assert payload["sub"] == "testuser"
    assert payload["role"] == "admin"
    assert "exp" in payload
    print("OK")


def test_jwt_expired():
    print("test_jwt_expired...", end=" ")
    from datetime import timedelta
    import jwt as pyjwt
    token = create_access_token(data={"sub": "expired_user"}, expires_delta=timedelta(seconds=-1))
    try:
        decode_access_token(token)
        assert False, "Should have raised"
    except pyjwt.ExpiredSignatureError:
        pass
    print("OK")


def test_login_success():
    print("test_login_success...", end=" ")
    client = TestClient(app)
    resp = client.post("/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    print("OK")


def test_login_wrong_password():
    print("test_login_wrong_password...", end=" ")
    client = TestClient(app)
    resp = client.post("/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401
    print("OK")


def test_login_user_not_found():
    print("test_login_user_not_found...", end=" ")
    client = TestClient(app)
    resp = client.post("/login", json={"username": "nonexistent", "password": "x"})
    assert resp.status_code == 401
    print("OK")


def test_me_with_valid_token():
    print("test_me_with_valid_token...", end=" ")
    client = TestClient(app)
    login_resp = client.post("/login", json={"username": "teacher1", "password": "teacher123"})
    token = login_resp.json()["access_token"]
    resp = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "teacher1"
    assert data["role"] == "teacher"
    print("OK")


def test_me_without_token():
    print("test_me_without_token...", end=" ")
    client = TestClient(app)
    resp = client.get("/me")
    assert resp.status_code in (401, 403)  # no auth header
    print("OK")


def test_me_with_invalid_token():
    print("test_me_with_invalid_token...", end=" ")
    client = TestClient(app)
    resp = client.get("/me", headers={"Authorization": "Bearer invalid-token-here"})
    assert resp.status_code == 401
    print("OK")


def test_role_admin_ok():
    print("test_role_admin_ok...", end=" ")
    client = TestClient(app)
    login_resp = client.post("/login", json={"username": "admin", "password": "admin123"})
    token = login_resp.json()["access_token"]
    resp = client.get("/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["message"] == "admin access granted"
    print("OK")


def test_role_teacher_denied():
    print("test_role_teacher_denied...", end=" ")
    client = TestClient(app)
    login_resp = client.post("/login", json={"username": "teacher1", "password": "teacher123"})
    token = login_resp.json()["access_token"]
    resp = client.get("/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    print("OK")


def test_role_student_denied():
    print("test_role_student_denied...", end=" ")
    client = TestClient(app)
    login_resp = client.post("/login", json={"username": "student1", "password": "student123"})
    token = login_resp.json()["access_token"]
    resp = client.get("/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    print("OK")


def test_role_teacher_plus_endpoint():
    print("test_role_teacher_plus_endpoint...", end=" ")
    client = TestClient(app)
    # Admin can access teacher-only
    login_resp = client.post("/login", json={"username": "admin", "password": "admin123"})
    token = login_resp.json()["access_token"]
    resp = client.get("/teacher-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    # Teacher can access teacher-only
    login_resp = client.post("/login", json={"username": "teacher1", "password": "teacher123"})
    token = login_resp.json()["access_token"]
    resp = client.get("/teacher-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    # Student cannot access teacher-only
    login_resp = client.post("/login", json={"username": "student1", "password": "student123"})
    token = login_resp.json()["access_token"]
    resp = client.get("/teacher-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    print("OK")


if __name__ == "__main__":
    import asyncio

    print("=== 01_auth MVP Test ===\n")

    # Setup database
    asyncio.run(setup_db())

    # Core tests (no HTTP)
    test_password_hashing()
    test_jwt_token()
    test_jwt_expired()

    # HTTP endpoint tests (TestClient)
    test_login_success()
    test_login_wrong_password()
    test_login_user_not_found()
    test_me_with_valid_token()
    test_me_without_token()
    test_me_with_invalid_token()
    test_role_admin_ok()
    test_role_teacher_denied()
    test_role_student_denied()
    test_role_teacher_plus_endpoint()

    # Cleanup
    try:
        os.unlink(_test_db)
    except OSError:
        pass

    print("\n✅ All 13 tests passed!")
