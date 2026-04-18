# CLAUDE.md — courseagent/backend

独立后端项目，FastAPI + SQLite + ChromaDB，无外部 sys.path 引用。

## 启动

```bash
cd courseagent/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

## 测试

```bash
cd courseagent/backend
.venv/bin/python tests/test_api.py
```

## 关键结构

- `app/main.py` — FastAPI 入口，33 个路由，CORS 已配置
- `app/api/` — 按角色分文件：admin, teacher, student, auth_routes, schemas
- `app/db/models.py` — 6 张表 (User, Document, Assignment, Submission, Report, Setting)
- `app/services/rag/` — 内联 RAG 管线
- `app/services/grading/` — 内联评分管线
- `app/services/rag_service.py` — RAG 服务封装
- `app/services/grading/service.py` — 评分服务 + DB 持久化

## 环境变量

参见 `.env.example`，必须配置 LLM_API_KEY / EMBEDDING_API_KEY 等。

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| admin | admin | admin123 |
| teacher | teacher1 | teacher123 |
| student | student1 | student123 |
