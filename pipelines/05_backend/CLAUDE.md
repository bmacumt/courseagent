# 05_backend — 主干集成 Pipeline

> 项目总文档：/home/binma/courseagent/CLAUDE.md

## 用途
FastAPI 主干服务，整合认证、RAG、评分三个 Pipeline，提供完整的业务 API。

## 虚拟环境
路径：`.venv` | Python 3.12 | uv

## 运行
```
.venv/bin/python mvp_test.py
.venv/bin/uvicorn server.main:app --reload
```

## 安装依赖
```
uv pip install fastapi pyjwt bcrypt sqlalchemy aiosqlite python-dotenv uvicorn httpx openai tiktoken chromadb rank-bm25 pydantic jinja2 json-repair requests python-multipart PyMuPDF python-docx --python .venv/bin/python
```

## 模块状态
| 模块 | 状态 |
|------|------|
| config (统一配置) | ✅ |
| db/models (6张表) | ✅ |
| db/engine (async SQLite) | ✅ |
| auth/jwt (密码+JWT) | ✅ |
| auth/deps (权限校验) | ✅ |
| api/auth_routes (登录/me) | ✅ |
| api/admin (用户管理+统计+配置) | ✅ |
| api/teacher (知识库+作业) | ✅ |
| api/student (提交+报告+问答) | ✅ |
| services/rag_service (03_rag封装) | ✅ |
| services/grading_service (04_grading封装) | ✅ |
| services/file_parser (PDF/Word解析) | ✅ |

## 数据库表
users, documents, assignments, submissions, reports, settings

## 关键设计
- 包名 `server/`（避免与 03_rag 的 `app/` 冲突）
- 跨 Pipeline 引用：sys.path.insert + from app.xxx / from grading.xxx
- 后台评分：FastAPI BackgroundTasks
- 数据隔离：SQLAlchemy WHERE 过滤 owner_id / teacher_id / student_id
- 允许学生覆盖重交（每次创建新记录）
- 学生提交支持文本+文件（PDF/Word）双模式，保留附件可下载
- 教师可导出学生成绩 CSV
- QA 返回结构化引用来源（文档名+段落号）

## 项目文档索引
- 总文档：`/home/binma/courseagent/CLAUDE.md`
- 本 Pipeline 文档：`/home/binma/courseagent/docs/05_backend.md`
- 服务规范：`/home/binma/courseagent/docs/backend_service_specification-v0.0.md`
- 依赖 Pipeline：01_auth, 03_rag, 04_grading
