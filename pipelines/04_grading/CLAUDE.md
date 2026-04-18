# 04_grading — 评分智能体 Pipeline

> 项目总文档：/home/binma/courseagent/CLAUDE.md

## 虚拟环境
路径：`.venv` | Python 3.12 | uv

## 运行
```
.venv/bin/python mvp_test.py
```

## 安装依赖
```
uv pip install openai tiktoken chromadb rank-bm25 pydantic python-dotenv jinja2 json-repair requests httpx --python .venv/bin/python
```

## 模块状态
| 模块 | 状态 |
|------|------|
| models (Pydantic) | ✅ |
| rag_bridge (subprocess隔离) | ✅ |
| prompts/ (3个模板) | ✅ |
| scorer (维度评分+规范验证) | ✅ |
| agent (流程编排) | ✅ |

## 项目文档索引
- 总文档：`/home/binma/courseagent/CLAUDE.md`
- 本 Pipeline 文档：`/home/binma/courseagent/docs/04_grading.md`
- 依赖 RAG Pipeline：`/home/binma/courseagent/pipelines/03_rag/`
- 方案文档：`/home/binma/courseagent/方案.md`
