# 隧道工程课程智能体 — 项目总文档

## 项目概述
基于 RAG + LLM 的隧道工程教学辅助系统，支持作业评改和知识问答。

## 技术栈
- 后端：FastAPI + SQLite + ChromaDB
- AI：LangChain + LangGraph + ragflow结构化分块
- 模型：全云端（DeepSeek / SiliconFlow Embedding & Reranker / MinerU API）
- 环境：uv 管理，每个 Pipeline 独立 venv. 最终后端的服务务必使用 uv 创建独立的虚拟环境

## Pipeline 列表
| 序号 | 名称       | 路径              | 文档              |
| ---- | ---------- | ----------------- | ----------------- |
| 01   | 认证授权   | /pipelines/01_auth| /docs/01_auth.md  |
| 03   | RAG+问答   | /pipelines/03_rag | /docs/03_rag.md   |
| 04   | 评改智能体 | /pipelines/04_grading | /docs/04_grading.md |
| 05   | 主干集成   | /pipelines/05_backend | /docs/backend_service_specification-v0.0.md |

## 开发顺序
01_auth(✅) → 03_rag(✅) → 04_grading(✅) → 05_backend(✅) → 前端 + 联调

## 环境变量
所有 API Key 存放在各 Pipeline 的 .env 文件中，后期迁移到数据库。
