# 03_rag — RAG 核心 Pipeline

> 项目总文档：/home/binma/courseagent/CLAUDE.md

## 虚拟环境
路径：`.venv` | Python 3.12 | uv

## 运行
```
.venv/bin/python mvp_core.py
.venv/bin/python mvp_chunking.py
.venv/bin/python mvp_prompts.py
.venv/bin/python mvp_deep_research.py
.venv/bin/python mvp_e2e_parse.py
.venv/bin/python mvp_rag_full.py      # 完整 RAG 管线测试
```

## 安装依赖
```
uv pip install tiktoken openai python-dotenv jinja2 chromadb rank-bm25 json-repair requests --python .venv/bin/python
```

## 模块状态
| 模块 | 状态 |
|------|------|
| core/token_utils | ✅ |
| core/llm_client | ✅ |
| parser/mineru_client | ✅ |
| chunking/ (全部) | ✅ |
| prompts/ (全部) | ✅ |
| advanced_rag/deep_research | ✅ |
| embedder | ✅ |
| vector_store | ✅ |
| retriever (hybrid) | ✅ |
| reranker | ✅ |
| qa_chain | ✅ |
| manager | ✅ |

## 项目文档索引
- 总文档：`/home/binma/courseagent/CLAUDE.md`
- 本 Pipeline 文档：`/home/binma/courseagent/docs/03_rag.md`
- 集成规划：`/home/binma/courseagent/docs/ragflow_rag_integration_plan.md`
- MinerU 规范：`/home/binma/courseagent/docs/mineru_specification-v1.0.md`
- ragflow rag 源码：`/home/binma/ragflow/rag/`
