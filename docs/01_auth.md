# 01_auth — 认证授权 Pipeline 技术文档

## 1. 概述

JWT 认证授权模块，支持用户登录、Token 验证、基于角色的访问控制（admin/teacher/student）。

---

## 2. 技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| Web 框架 | FastAPI | 异步 API、依赖注入 |
| 数据库 | SQLite + aiosqlite | 异步用户表存储 |
| ORM | SQLAlchemy 2.0 (async) | 用户模型 |
| 密码哈希 | bcrypt | 安全密码存储 |
| JWT | PyJWT (HS256) | Token 签发与验证 |
| 配置 | python-dotenv | 环境变量加载 |

## 3. 虚拟环境

- **路径**: `/pipelines/01_auth/.venv`
- **Python**: 3.12
- **工具**: uv
- **安装依赖**:
  ```bash
  uv pip install fastapi pyjwt bcrypt sqlalchemy aiosqlite python-dotenv uvicorn httpx --python .venv/bin/python
  ```

## 4. 目录结构

```
01_auth/
├── .venv/                   # uv 虚拟环境
├── .env                     # SECRET_KEY, DATABASE_PATH
├── .env.example             # 配置模板
├── CLAUDE.md                # Pipeline 开发规范
├── data/                    # SQLite 数据库目录
├── mvp_test.py              # MVP 测试（13 项测试）
└── app/
    ├── __init__.py
    ├── config.py            # 环境变量配置
    ├── database.py          # SQLAlchemy async 引擎 + session
    ├── models.py            # User ORM 模型
    ├── auth.py              # 密码哈希 + JWT 工具函数
    ├── deps.py              # FastAPI 依赖: get_current_user, require_role
    └── main.py              # FastAPI 应用: /login, /me, /admin-only, /teacher-only
```

---

## 5. 模块输入输出

### 5.1 config.py

| 变量 | 环境变量 | 默认值 |
|------|---------|--------|
| `SECRET_KEY` | `SECRET_KEY` | `dev-secret-change-me` |
| `DATABASE_PATH` | `DATABASE_PATH` | `./data/auth.db` |
| `ALGORITHM` | - | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |

### 5.2 models.py

```sql
users:
  id            INTEGER PRIMARY KEY AUTOINCREMENT
  username      VARCHAR(50) UNIQUE NOT NULL
  password_hash VARCHAR(128) NOT NULL
  role          VARCHAR(20) NOT NULL   -- admin / teacher / student
  created_at    DATETIME
```

### 5.3 database.py

| 函数 | 输入 | 输出 |
|------|------|------|
| `init_db()` | - | None（创建表） |
| `get_session()` | - | AsyncGenerator[AsyncSession] |

### 5.4 auth.py

| 函数 | 输入 | 输出 |
|------|------|------|
| `hash_password(password)` | `str` | `str` (bcrypt hash) |
| `verify_password(plain, hashed)` | `str, str` | `bool` |
| `create_access_token(data, expires_delta?)` | `dict, timedelta?` | `str` (JWT) |
| `decode_access_token(token)` | `str` | `dict` (payload) |

JWT payload 结构: `{"sub": username, "role": role, "exp": timestamp}`

### 5.5 deps.py

| 依赖函数 | 输入 | 输出 |
|---------|------|------|
| `get_current_user(credentials, session)` | Bearer token + DB session | `User` |
| `require_role(*roles)` | 角色列表 | Dependency → `User`（不满足则 403） |

### 5.6 main.py — API 端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/login` | 无 | 验证密码，返回 JWT |
| GET | `/me` | Bearer | 返回当前用户信息 |
| GET | `/admin-only` | Bearer (admin) | 仅管理员 |
| GET | `/teacher-only` | Bearer (admin/teacher) | 管理员+教师 |

**请求/响应**:

```
POST /login
  Body: {"username": "admin", "password": "admin123"}
  200: {"access_token": "eyJ...", "token_type": "bearer"}
  401: {"detail": "Incorrect username or password"}

GET /me
  Header: Authorization: Bearer <token>
  200: {"id": 1, "username": "admin", "role": "admin"}
  401: {"detail": "Invalid or expired token"}

GET /admin-only
  Header: Authorization: Bearer <admin_token>
  200: {"message": "admin access granted"}
  403: {"detail": "Requires one of roles: admin"}
```

---

## 6. 环境变量

```env
SECRET_KEY=change-me-to-a-random-string-at-least-32-bytes
DATABASE_PATH=./data/auth.db
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

---

## 7. 测试文件

**mvp_test.py** — 13 项测试，使用 FastAPI TestClient（无需启动服务器）:

| 测试 | 验证内容 |
|------|---------|
| test_password_hashing | bcrypt 哈希/验证往返 |
| test_jwt_token | JWT 创建/解码 |
| test_jwt_expired | 过期 token 抛异常 |
| test_login_success | 正确密码返回 token |
| test_login_wrong_password | 错误密码返回 401 |
| test_login_user_not_found | 不存在用户返回 401 |
| test_me_with_valid_token | 有效 token 返回用户信息 |
| test_me_without_token | 无 token 返回 401/403 |
| test_me_with_invalid_token | 假 token 返回 401 |
| test_role_admin_ok | admin 可访问 /admin-only |
| test_role_teacher_denied | teacher 访问 /admin-only → 403 |
| test_role_student_denied | student 访问 /admin-only → 403 |
| test_role_teacher_plus_endpoint | admin/teacher 可访问, student → 403 |

---

## 8. 关联文档

- 项目总方案：[/方案.md](../方案.md)
- 根 CLAUDE.md：`/home/binma/courseagent/CLAUDE.md`
