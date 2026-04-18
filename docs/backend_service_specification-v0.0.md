# 隧道工程课程智能体 — 后端服务规范 v0.0

> 文档日期：2026-04-18
> 代码位置：`pipelines/05_backend/`
> 状态：MVP 测试通过

---

## 1. 系统概述

基于 RAG + LLM 的隧道工程教学辅助系统，支持作业评改、知识问答、多角色权限管理。

### 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI | 异步、自动文档 |
| 业务数据库 | SQLite + aiosqlite | 单文件、零配置 |
| 向量数据库 | ChromaDB | 轻量、Python 原生 |
| LLM | DeepSeek API | 中文问答 + 评分 |
| Embedding | SiliconFlow BAAI/bge-large-zh-v1.5 | 1024 维 |
| Reranker | SiliconFlow BAAI/bge-reranker-v2-m3 | 重排序 |
| PDF 解析 | MinerU API | 云端服务 |
| 认证 | JWT (PyJWT + bcrypt) | Token 过期可配 |
| 包管理 | uv | 独立 venv |

### 系统架构

```
┌─────────────────────────────────────────┐
│              FastAPI 主干                │
│           (server/main.py)              │
├──────────┬──────────┬───────────────────┤
│ admin    │ teacher  │ student           │
│ 用户管理  │ 知识库    │ 作业提交          │
│ 统计配置  │ 作业管理   │ 报告查看          │
│          │ 报告查看   │ 知识问答          │
├──────────┴──────────┴───────────────────┤
│           服务层 (services/)             │
│  RAGService ─────→ 03_rag PipelineManager│
│  GradingService ─→ 04_grading Agent      │
├─────────────────────────────────────────┤
│     认证层 (auth/jwt + auth/deps)        │
│     bcrypt 密码 + JWT Token + RBAC       │
├─────────────────────────────────────────┤
│     数据层 (db/)                         │
│     SQLite 6 张表 + ChromaDB 向量        │
└─────────────────────────────────────────┘
```

---

## 2. 数据库设计

### 2.1 ER 关系

```
User ──1:N──→ Document (owner_id)
User ──1:N──→ Assignment (teacher_id)
User ──1:N──→ Submission (student_id)
Assignment ──1:N──→ Submission (assignment_id)
Submission ──1:1──→ Report (submission_id)
Setting (独立表)
```

### 2.2 表结构

#### users

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | INTEGER | PK, AUTO | |
| username | VARCHAR(50) | UNIQUE, INDEX, NOT NULL | 登录名 |
| password_hash | VARCHAR(128) | NOT NULL | bcrypt |
| role | VARCHAR(20) | NOT NULL | admin / teacher / student |
| real_name | VARCHAR(100) | NULL | 真实姓名 |
| student_id | VARCHAR(50) | NULL, UNIQUE | 学号 |
| class_name | VARCHAR(100) | NULL | 班级 |
| created_at | DATETIME | DEFAULT utcnow | |

#### documents

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | INTEGER | PK | |
| doc_uuid | VARCHAR(12) | UNIQUE, INDEX | ChromaDB 文档 ID |
| filename | VARCHAR(255) | NOT NULL | 原始文件名 |
| title | VARCHAR(255) | NOT NULL | 文档标题 |
| doc_type | VARCHAR(50) | DEFAULT "specification" | 类型 |
| owner_id | INTEGER | FK → users.id, INDEX | 上传教师 |
| chunk_count | INTEGER | DEFAULT 0 | 分块数量 |
| file_path | VARCHAR(512) | NOT NULL | 本地路径 |
| uploaded_at | DATETIME | DEFAULT utcnow | |

#### assignments

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | INTEGER | PK | |
| teacher_id | INTEGER | FK → users.id, INDEX | 发布教师 |
| title | VARCHAR(255) | NOT NULL | 作业标题 |
| description | TEXT | NOT NULL | 题目描述 |
| question | TEXT | NOT NULL | 具体题目（传给评分 Agent） |
| reference_answer | TEXT | NULL | 参考答案 |
| grading_criteria | TEXT | NOT NULL | JSON: GradingCriteria |
| deadline | DATETIME | NULL | 截止时间 |
| is_published | BOOLEAN | DEFAULT FALSE | 是否已发布 |
| created_at | DATETIME | DEFAULT utcnow | |

#### submissions

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | INTEGER | PK | |
| assignment_id | INTEGER | FK → assignments.id, INDEX | |
| student_id | INTEGER | FK → users.id, INDEX | |
| content | TEXT | NOT NULL | 学生答案（文本或解析后的文件内容） |
| attachment_path | VARCHAR(512) | NULL | 原始附件文件路径 |
| status | VARCHAR(20) | DEFAULT "submitted" | submitted/grading/graded/failed |
| submitted_at | DATETIME | DEFAULT utcnow | |
| updated_at | DATETIME | NULL | 重交时间 |

**无 UniqueConstraint** — 允许覆盖重交，每次创建新记录。

#### reports

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | INTEGER | PK | |
| submission_id | INTEGER | FK → submissions.id, UNIQUE | 1:1 |
| total_score | FLOAT | NOT NULL | |
| max_score | INTEGER | DEFAULT 100 | |
| dimension_scores | TEXT | NOT NULL | JSON: list[DimensionResult] |
| feedback | TEXT | NOT NULL | 综合评语 |
| references | TEXT | DEFAULT "[]" | JSON |
| regulations_found | TEXT | DEFAULT "[]" | JSON |
| regulations_cited | TEXT | DEFAULT "[]" | JSON |
| created_at | DATETIME | DEFAULT utcnow | |

#### settings

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | INTEGER | PK | |
| key | VARCHAR(100) | UNIQUE, INDEX | 配置键 |
| value | TEXT | NOT NULL | 配置值 |
| category | VARCHAR(50) | DEFAULT "general" | 分类 |
| updated_at | DATETIME | DEFAULT utcnow, ON UPDATE | |

### 2.3 ChromaDB 存储策略

统一 Collection + Metadata 过滤：

```json
{
  "doc_id": "a1b2c3d4e5f6",
  "chunk_index": 0,
  "source": "JTG 1001-2017.pdf"
}
```

检索时不限制 owner_id（全局搜索），删除时按 doc_id 过滤。

---

## 3. API 接口规范

### 3.1 认证

#### POST /login

```json
// Request
{ "username": "admin", "password": "admin123" }

// Response 200
{ "access_token": "eyJ...", "token_type": "bearer" }

// Response 401
{ "detail": "Invalid credentials" }
```

#### GET /me

```
Authorization: Bearer eyJ...

// Response 200
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "real_name": "管理员",
  "student_id": null,
  "class_name": null,
  "created_at": "2026-04-18T10:00:00"
}
```

### 3.2 管理员接口（需 admin 角色）

#### POST /admin/users — 创建用户

```json
// Request
{
  "username": "teacher_zhang",
  "password": "pass123",
  "role": "teacher",
  "real_name": "张老师"
}

// Response 200
{
  "id": 5,
  "username": "teacher_zhang",
  "role": "teacher",
  "real_name": "张老师",
  "student_id": null,
  "class_name": null,
  "created_at": "2026-04-18T10:00:00"
}
```

#### POST /admin/users/batch — 批量导入学生

```json
// Request
{
  "students": [
    { "username": "stu_001", "password": "123456", "real_name": "王同学", "student_id": "S001", "class_name": "隧道一班" },
    { "username": "stu_002", "password": "123456", "real_name": "李同学", "student_id": "S002", "class_name": "隧道一班" }
  ]
}

// Response 200
{
  "success_count": 2,
  "failed": [],
  "created_ids": [6, 7]
}
```

#### GET /admin/users — 用户列表

```
// Query params: ?role=student&class_name=隧道一班

// Response 200
[
  { "id": 4, "username": "student1", "role": "student", "real_name": "王同学", "student_id": "2024001", "class_name": "隧道一班", "created_at": "..." }
]
```

#### PUT /admin/users/{id} — 更新用户

```json
// Request
{ "real_name": "王大明", "password": "newpass" }
```

#### DELETE /admin/users/{id} — 删除用户

不可删除自己。

#### GET /admin/stats — 系统统计

```json
{
  "total_users": 15,
  "total_documents": 5,
  "total_assignments": 3,
  "total_submissions": 30
}
```

#### GET /admin/settings — 获取配置

```json
{
  "llm": [
    { "id": 1, "key": "llm_model", "value": "deepseek-chat", "category": "llm", "updated_at": "..." }
  ]
}
```

#### PUT /admin/settings/{key} — 更新配置

```json
// Request
{ "value": "deepseek-v3" }

// Response 200
{ "id": 1, "key": "llm_model", "value": "deepseek-v3", "category": "llm", "updated_at": "..." }
```

### 3.3 教师接口（需 teacher 或 admin 角色）

#### POST /teacher/knowledge — 上传文档

```
Content-Type: multipart/form-data

title: JTG 1001-2017 公路工程标准体系
doc_type: specification
file: (PDF binary)
```

```json
// Response 200
{
  "id": 1,
  "doc_uuid": "a1b2c3d4e5f6",
  "filename": "JTG 1001-2017.pdf",
  "title": "JTG 1001-2017 公路工程标准体系",
  "doc_type": "specification",
  "owner_id": 2,
  "chunk_count": 11,
  "uploaded_at": "2026-04-18T10:00:00"
}
```

#### GET /teacher/knowledge — 文档列表

仅返回当前教师的文档（owner_id 隔离）。

#### DELETE /teacher/knowledge/{id} — 删除文档

验证 owner_id 后删除 DB 记录 + ChromaDB 向量 + 本地文件。

#### POST /teacher/assignments — 创建作业

```json
// Request
{
  "title": "公路工程标准体系概述",
  "description": "请阐述公路工程标准体系的总体框架结构",
  "question": "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。",
  "reference_answer": "标准体系分为六大板块...",
  "grading_criteria": {
    "dimensions": [
      { "name": "accuracy", "label": "准确性", "weight": 0.4, "description": "内容是否正确" },
      { "name": "completeness", "label": "完整性", "weight": 0.3, "description": "是否覆盖要点" },
      { "name": "innovation", "label": "创新性", "weight": 0.3, "description": "是否有独立思考" }
    ],
    "reference_answer": "标准体系分为六大板块..."
  },
  "deadline": "2026-05-01T23:59:59"
}
```

不提供 `grading_criteria` 时使用默认 4 维度：准确性(30%) + 完整性(25%) + 规范性(25%) + 创新性(20%)。

#### GET /teacher/assignments — 作业列表

```json
[
  {
    "id": 1,
    "title": "公路工程标准体系概述",
    "is_published": true,
    "deadline": "2026-05-01T23:59:59",
    "created_at": "2026-04-18T10:00:00",
    "submission_count": 15
  }
]
```

#### PUT /teacher/assignments/{id}/publish — 发布作业

已发布的作业不可编辑/删除。

#### GET /teacher/assignments/{id}/submissions — 查看提交

```json
[
  {
    "id": 1,
    "assignment_id": 1,
    "student_name": "student1",
    "student_real_name": "王同学",
    "status": "graded",
    "submitted_at": "2026-04-18T14:00:00",
    "total_score": 85.5
  }
]
```

#### GET /teacher/reports/{id} — 查看报告

```json
{
  "id": 1,
  "submission_id": 1,
  "total_score": 85.5,
  "max_score": 100,
  "dimension_scores": [
    { "name": "accuracy", "label": "准确性", "score": 90, "weight": 0.3, "weighted_score": 27.0, "comment": "..." },
    { "name": "completeness", "label": "完整性", "score": 85, "weight": 0.25, "weighted_score": 21.25, "comment": "..." },
    { "name": "compliance", "label": "规范性", "score": 80, "weight": 0.25, "weighted_score": 20.0, "comment": "..." },
    { "name": "innovation", "label": "创新性", "score": 85, "weight": 0.2, "weighted_score": 17.0, "comment": "..." }
  ],
  "feedback": "整体表现良好...",
  "references": ["JTG 1001-2017 3.2"],
  "regulations_found": ["JTG 1001-2017 第3.2条"],
  "regulations_cited": ["JTG 1001-2017"],
  "created_at": "2026-04-18T14:01:00"
}
```

### 3.4 学生接口（需 student 角色）

#### GET /student/assignments — 可提交作业

```json
[
  {
    "id": 1,
    "title": "公路工程标准体系概述",
    "description": "请阐述公路工程标准体系的总体框架结构",
    "question": "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。",
    "deadline": "2026-05-01T23:59:59",
    "teacher_name": "张老师",
    "has_submitted": false
  }
]
```

#### POST /student/assignments/{id}/submit — 提交答案

```
Content-Type: multipart/form-data

// 至少提供 content 或 file 其中一项
content: "公路工程标准体系采用三层结构..."    // string, 可选
file: (PDF/Word binary)                      // File, 可选 (.pdf/.docx)

// Response 200
{ "id": 1, "status": "submitted" }
```

- 支持三种模式：纯文本、纯文件、文本+文件
- 文件上传后自动解析为文本，与手输内容合并存入 `content`
- 原始文件保存到 `data/uploads/submissions/`，路径记录在 `attachment_path`
- 允许覆盖重交（每次创建新记录）
- 后台自动触发评分（BackgroundTasks）
- 超过 deadline 返回 400

#### GET /student/submissions/{id}/attachment — 下载附件

```
// Response 200 → FileResponse
// 直接下载原始上传文件

// Response 404
{ "detail": "No attachment found" }
```

仅返回当前学生自己的提交附件。

#### GET /student/submissions — 我的提交

```json
[
  {
    "id": 1, "assignment_id": 1,
    "student_name": "student1", "student_real_name": "王同学",
    "status": "graded", "submitted_at": "...",
    "total_score": 85.5, "has_attachment": true
  }
]
```

仅返回当前学生的提交。`has_attachment` 标记是否有附件可下载。

#### GET /student/reports/{id} — 查看报告

验证 submission.student_id == current_user.id。

#### POST /student/qa — 知识问答

```json
// Request
{ "question": "公路建设板块包含哪些模块？" }

// Response 200
{
  "answer": "公路建设板块包含勘测、设计、试验、检测、施工、监理、项目管理、造价共8个模块...",
  "sources": [
    {
      "index": 1,
      "text": "公路建设板块包含勘测、设计、试验、检测、施工、监理、项目管理、造价共8个模块...",
      "source_name": "JTG 1001-2017.pdf",
      "chunk_index": 3
    }
  ]
}
```

`sources` 为结构化引用，包含来源文档名和段落编号。

---

## 4. 权限隔离规则

| 操作 | admin | teacher | student |
|------|-------|---------|---------|
| 用户管理 CRUD | ✅ 全部 | ❌ | ❌ |
| 系统统计 | ✅ | ❌ | ❌ |
| 配置管理 | ✅ | ❌ | ❌ |
| 上传/删除自己的文档 | ✅ | ✅ | ❌ |
| 查看自己的文档列表 | ✅ | ✅ | ❌ |
| 创建/编辑自己的作业 | ✅ | ✅ | ❌ |
| 发布/删除自己的作业 | ✅ | ✅ | ❌ |
| 查看自己作业的提交 | ✅ | ✅ | ❌ |
| 查看所有评分报告 | ✅ | ✅ (自己的作业) | ✅ (自己的提交) |
| 提交作业 | ❌ | ❌ | ✅ |
| 知识问答 | ❌ | ❌ | ✅ |
| 查看已发布作业 | ❌ | ❌ | ✅ |

**数据隔离实现：**
- 教师文档：`WHERE owner_id = current_user.id`
- 教师作业：`WHERE teacher_id = current_user.id`
- 学生提交：`WHERE student_id = current_user.id`
- 报告查看：通过提交记录间接验证所有权

---

## 5. 评分流程

```
学生提交答案
  ↓
创建 Submission (status="submitted")
  ↓
BackgroundTasks 触发 GradingService
  ↓
status → "grading"
  ↓
RAG 检索规范条文 (RAGBridge.retrieve_regulations)
  ↓
逐维度评分 (4维度并行, LLM)
  ↓
规范验证 (LLM 检查引用)
  ↓
后端计算总分 (Python 加权平均)
  ↓
生成综合评语 (LLM)
  ↓
持久化 Report + status → "graded"
```

**评分维度（默认）：**

| 维度 | 权重 | 说明 |
|------|------|------|
| 准确性 | 30% | 内容是否正确，技术要点准确 |
| 完整性 | 25% | 是否覆盖题目要求的所有要点 |
| 规范性 | 25% | 是否引用相关规范标准（RAG 加持） |
| 创新性 | 20% | 是否有独立思考、见解 |

老师可在创建作业时自定义维度和权重。

---

## 6. 目录结构

```
pipelines/05_backend/
├── .venv/
├── .env
├── .env.example
├── CLAUDE.md
├── mvp_test.py
├── server/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app + router 聚合
│   ├── config.py                 # 统一配置
│   ├── db/
│   │   ├── __init__.py
│   │   ├── engine.py             # Async engine + session
│   │   └── models.py             # 6 张表 ORM
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── jwt.py                # bcrypt + JWT
│   │   └── deps.py               # get_current_user, require_role
│   ├── api/
│   │   ├── __init__.py
│   │   ├── schemas.py            # Pydantic 请求/响应模型
│   │   ├── auth_routes.py        # /login, /me
│   │   ├── admin.py              # /admin/*
│   │   ├── teacher.py            # /teacher/*
│   │   └── student.py            # /student/*
│   └── services/
│       ├── __init__.py
│       ├── rag_service.py        # 封装 03_rag
│       ├── grading_service.py    # 封装 04_grading
│       └── file_parser.py        # PDF/Word 文件解析
└── data/
    ├── app.db
    ├── chroma/
    └── uploads/
        └── submissions/              # 学生提交的附件
```

**包名说明：** 使用 `server/` 而非 `app/`，避免与 03_rag 的 `app/` 包名冲突。

---

## 7. 环境变量

```env
# 应用
SECRET_KEY=dev-secret-change-me
DATABASE_PATH=./data/app.db
ACCESS_TOKEN_EXPIRE_MINUTES=60
CHROMA_PATH=./data/chroma
UPLOAD_DIR=./data/uploads
SUBMISSION_DIR=./data/uploads/submissions

# LLM
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# Embedding
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# Reranker
RERANKER_API_KEY=sk-xxx
RERANKER_BASE_URL=https://api.siliconflow.cn/v1
RERANKER_MODEL=BAAI/bge-reranker-v2-m3

# MinerU
MINERU_API_TOKEN=xxx
MINERU_BASE_URL=https://mineru.net/api/v4
```

---

## 8. API 端点汇总

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | /login | - | 登录 |
| GET | /me | 任意已认证 | 当前用户 |
| GET | /health | - | 健康检查 |
| POST | /admin/users | admin | 创建用户 |
| POST | /admin/users/batch | admin | 批量导入 |
| GET | /admin/users | admin | 用户列表 |
| PUT | /admin/users/{id} | admin | 更新用户 |
| DELETE | /admin/users/{id} | admin | 删除用户 |
| GET | /admin/stats | admin | 系统统计 |
| GET | /admin/settings | admin | 获取配置 |
| PUT | /admin/settings/{key} | admin | 更新配置 |
| POST | /teacher/knowledge | teacher+ | 上传文档 |
| GET | /teacher/knowledge | teacher+ | 文档列表 |
| DELETE | /teacher/knowledge/{id} | teacher+ | 删除文档 |
| POST | /teacher/assignments | teacher+ | 创建作业 |
| GET | /teacher/assignments | teacher+ | 作业列表 |
| PUT | /teacher/assignments/{id} | teacher+ | 编辑作业 |
| PUT | /teacher/assignments/{id}/publish | teacher+ | 发布 |
| DELETE | /teacher/assignments/{id} | teacher+ | 删除作业 |
| GET | /teacher/assignments/{id}/submissions | teacher+ | 查看提交 |
| GET | /teacher/assignments/{id}/export | teacher+ | 导出成绩 CSV |
| GET | /teacher/reports/{id} | teacher+ | 查看报告 |
| GET | /student/assignments | student | 作业列表 |
| GET | /student/assignments/{id} | student | 作业详情 |
| POST | /student/assignments/{id}/submit | student | 提交答案（文本/文件/组合） |
| GET | /student/submissions/{id}/attachment | student | 下载附件 |
| GET | /student/submissions | student | 我的提交 |
| GET | /student/reports/{id} | student | 查看报告 |
| POST | /student/qa | student | 知识问答 |
