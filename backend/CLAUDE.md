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

```
app/
├── main.py                          — FastAPI 入口，CORS、lifespan、router 注册
├── config.py                        — 环境变量集中配置（SECRET_KEY, DB路径, 上传目录等）
│
├── api/                             — 路由层，按角色分文件
│   ├── admin.py                     — 管理员：用户 CRUD、统计、设置 key-value 编辑
│   ├── teacher.py                   — 教师：知识库上传/删除、作业 CRUD、提交列表、评分报告、附件下载、CSV导出
│   ├── student.py                   — 学生：作业列表、提交（文本/附件）、QA问答（含SSE流式）、报告查看、附件下载
│   ├── models.py                    — 模型管理：提供商 CRUD、验证、模型配置、系统默认模型
│   ├── auth_routes.py               — 登录/获取当前用户
│   └── schemas.py                   — 所有 Pydantic request/response schema
│
├── auth/                            — 认证
│   ├── jwt.py                       — JWT 创建/验证
│   └── deps.py                      — require_role 依赖注入
│
├── db/                              — 数据库
│   ├── engine.py                    — AsyncSession 工厂、init_db
│   └── models.py                    — ORM 模型：User, Document, Assignment, Submission, Report, Setting, ModelProvider, ModelConfig
│
└── services/                        — 业务逻辑
    ├── rag_service.py               — RAG 服务门面（ingest、query、stream_query、delete）
    ├── settings_service.py          — 设置服务：seed 默认值、DB→os.environ 同步
    ├── config_resolver.py           — 模型配置解析：查 DB 默认模型 → env var 回退，sync 到 os.environ
    ├── model_registry.py            — 提供商静态注册表（DeepSeek/SiliconFlow/OpenAI/通义/智谱/Moonshot）
    ├── file_parser.py               — 文件解析（PDF/DOCX → 纯文本）
    │
    ├── rag/                         — RAG 管线
    │   ├── manager.py               — PipelineManager：ingest + query + stream_query 入口
    │   ├── qa_chain.py              — QAChain：retrieve → rerank → LLM生成（answer / stream_answer）
    │   ├── llm_client.py            — AsyncOpenAI 封装，async_chat + async_stream_chat
    │   ├── embedder.py              — 向量嵌入（SiliconFlow API）
    │   ├── reranker.py              — 重排序（SiliconFlow rerank API）
    │   ├── retriever.py             — HybridRetriever（向量 + BM25 混合检索）
    │   ├── vector_store.py          — ChromaDB 封装（add/delete/query）
    │   ├── mineru_client.py         — MinerU API 客户端（PDF → 结构化内容）
    │   ├── token_utils.py           — Token 计数工具
    │   ├── prompts/
    │   │   └── loader.py            — Prompt 模板加载
    │   └── chunking/                — 分块
    │       ├── laws_chunker.py      — 法律/规范文档结构化分块
    │       ├── mineru_adapter.py    — MinerU 输出 → sections 转换
    │       ├── naive_chunker.py     — 简单固定大小分块
    │       ├── detector.py          — 文档类型检测
    │       ├── patterns.py          — 正则模式定义
    │       └── tree_merge.py        — 树形合并
    │
    └── grading/                     — 评分管线
        ├── service.py               — GradingService：编排整个评分流程 + DB 持久化
        ├── agent.py                 — LangGraph 评改智能体（多维度打分）
        ├── scorer.py                — 分数计算（加权聚合）
        ├── rag_bridge.py            — RAG 桥接（检索参考资料）
        └── models.py                — DEFAULT_CRITERIA 等评分模型定义
```

## 环境变量

参见 `.env.example`，必须配置 LLM_API_KEY / EMBEDDING_API_KEY 等。

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| admin | admin | admin123 |
| teacher | teacher1 | teacher123 |
| student | student1 | student123 |
