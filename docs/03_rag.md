# 03_rag — RAG 核心 Pipeline 技术文档

## 1. 概述

PDF 文档解析 + ragflow 结构化分块 + ChromaDB 向量存储 + 混合检索 + LLM 问答的完整 RAG 链路。

**已合并 02_mineru pipeline**，解析和分块统一在本 pipeline 内完成。

---

## 2. 技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| PDF 解析 | MinerU API (云端) | PDF → 结构化 JSON |
| 结构化分块 | ragflow 提取代码 (本地) | 编号检测 + 树形合并 |
| Token 计数 | tiktoken (cl100k_base) | 分块和 prompt 长度控制 |
| LLM | DeepSeek API (OpenAI 兼容) | 问答、关键词提取、充分性检查 |
| Embedding | SiliconFlow BAAI/bge-large-zh-v1.5 | 文本向量化 (1024维) |
| 向量存储 | ChromaDB (本地, cosine) | 向量检索 + metadata 过滤 |
| BM25 | rank-bm25 | 关键词检索 |
| 检索融合 | RRF (Reciprocal Rank Fusion) | 多路检索结果合并 |
| Reranker | SiliconFlow BAAI/bge-reranker-v2-m3 | 检索结果重排序 |
| 提示词模板 | jinja2 + ragflow 模板 | 问答/引用/关键词/充分性检查 |
| 异步 | asyncio + openai.AsyncOpenAI | 非阻塞 LLM 调用 |

## 3. 虚拟环境

- **路径**: `/pipelines/03_rag/.venv`
- **Python**: 3.12
- **工具**: uv
- **安装依赖**:
  ```bash
  uv pip install tiktoken openai python-dotenv jinja2 chromadb rank-bm25 requests json-repair --python .venv/bin/python
  ```

## 4. 目录结构

```
03_rag/
├── .venv/                         # uv 虚拟环境
├── .env                           # API Keys (不入库)
├── .env.example                   # 配置模板
├── CLAUDE.md                      # Pipeline 开发规范
├── output/                        # MinerU 解析结果临时目录
├── JTG 1001-2017 *.pdf            # 测试用 PDF
│
├── mvp_core.py                    # 测试: 基础设施 (token_utils, llm_client)
├── mvp_chunking.py                # 测试: 分块模块
├── mvp_prompts.py                 # 测试: 提示词模板
├── mvp_deep_research.py           # 测试: 深度检索
├── mvp_e2e_parse.py               # 测试: 端到端 PDF 解析
├── mvp_rag_full.py                # 测试: 完整 RAG 管线
│
└── app/
    ├── __init__.py
    ├── core/
    │   ├── token_utils.py         # tiktoken 包装: num_tokens_from_string, truncate
    │   └── llm_client.py          # async OpenAI/DeepSeek: LLMClient.async_chat()
    ├── parser/
    │   └── mineru_client.py       # MinerU API: upload_pdf, poll_results, parse_pdf
    ├── chunking/
    │   ├── patterns.py            # BULLET_PATTERN (5组编号正则) + not_bullet()
    │   ├── detector.py            # bullets_category(), is_chinese(), is_english()
    │   ├── tree_merge.py          # Node 类, tree_merge(), remove_contents_table()
    │   ├── mineru_adapter.py      # mineru_to_sections(): content_list → sections
    │   ├── laws_chunker.py        # chunk(): 法规风格结构化分块
    │   └── naive_chunker.py       # naive_merge(): 固定 token 合并
    ├── prompts/
    │   ├── loader.py              # load_prompt(), render_prompt(): jinja2 模板
    │   ├── generator.py           # keyword_extraction, sufficiency_check, multi_queries_gen
    │   └── templates/
    │       ├── ask_summary.md     # 问答系统提示词
    │       ├── citation.md        # 引用格式说明
    │       ├── keyword_extraction.md
    │       ├── question_generation.md
    │       ├── sufficiency_check.md
    │       └── multi_queries_gen.md
    ├── advanced_rag/
    │   └── deep_research.py       # DeepResearch: 迭代检索+充分性检查+查询分解
    ├── embedder.py                # ✅ SiliconFlow BGE 嵌入 (含 token 截断)
    ├── vector_store.py            # ✅ ChromaDB 持久化存储
    ├── retriever.py               # ✅ 混合检索: vector + BM25 + RRF
    ├── reranker.py                # ✅ SiliconFlow BGE 重排序
    ├── qa_chain.py                # ✅ 问答链: retrieve → rerank → LLM answer
    └── manager.py                 # ✅ 流程编排: ingest_pdf, query, delete_document
```

---

## 5. 模块输入输出

### 5.1 core/token_utils.py

| 函数 | 输入 | 输出 |
|------|------|------|
| `num_tokens_from_string(text)` | `str` | `int` (token 数) |
| `truncate(text, max_tokens)` | `str, int` | `str` (截断后文本) |

### 5.2 core/llm_client.py

| 类/方法 | 输入 | 输出 |
|---------|------|------|
| `LLMClient(api_key?, base_url?, model?)` | 配置参数或环境变量 | 实例 |
| `async_chat(system, messages, temperature?, max_tokens?)` | system提示, 消息列表 | `str` (LLM回复) |

**环境变量**: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`

### 5.3 parser/mineru_client.py

| 方法 | 输入 | 输出 |
|------|------|------|
| `upload_pdf(pdf_path, data_id?, language?)` | PDF路径 | `str` (batch_id) |
| `poll_results(batch_id, timeout?, interval?)` | batch_id | `dict` (state, full_zip_url) |
| `download_and_extract(zip_url, output_dir)` | URL, 目录 | `str` (content_list.json路径) |
| `parse_pdf(pdf_path, output_dir?)` | PDF路径 | `list[dict]` (content_list) |

**API 流程**: POST /file-urls/batch → PUT 上传(不带Content-Type) → GET 轮询 → 下载ZIP → 读取 content_list.json

**环境变量**: `MINERU_API_TOKEN`, `MINERU_BASE_URL`

### 5.4 chunking/ 模块群

```
PDF → MinerU → content_list.json
                    ↓
          mineru_adapter.mineru_to_sections()
                    ↓
          [(text, layout_type), ...]
                    ↓
          detector.bullets_category() → 检测编号模式
                    ↓
    有编号 → laws_chunker.chunk(sections) → 结构化分块
    无编号 → naive_chunker.naive_merge(sections) → 固定token合并
                    ↓
          list[str] (chunks, 带层级标题路径)
```

| 模块 | 输入 | 输出 | 来源 |
|------|------|------|------|
| `mineru_adapter.mineru_to_sections(content_list)` | MinerU content_list (list[dict]) | `list[tuple[str,str]]` | 新建 |
| `detector.bullets_category(sections)` | 文本列表 | `int` (模式索引, -1=无) | ragflow |
| `laws_chunker.chunk(sections, lang?, depth?)` | sections列表 | `list[str]` (分块) | ragflow |
| `naive_chunker.naive_merge(sections, chunk_token_num?)` | 文本列表 | `list[str]` (分块) | ragflow |

### 5.5 prompts/ 模块群

| 函数 | 输入 | 输出 |
|------|------|------|
| `load_prompt(name)` | 模板名 | `str` (原始模板) |
| `render_prompt(name, **kwargs)` | 模板名 + 变量 | `str` (渲染后) |
| `keyword_extraction(llm_client, content, topn?)` | LLM客户端, 文本 | `str` (关键词) |
| `sufficiency_check(llm_client, question, retrieved_docs)` | LLM, 问题, 检索内容 | `dict` (is_sufficient, missing_information) |
| `multi_queries_gen(llm_client, question, query, missing_infos, retrieved_docs)` | LLM, 原始查询, 缺失信息 | `dict` (questions列表) |
| `message_fit_in(msg, max_length)` | 消息列表, token上限 | `(int, list)` (实际token数, 裁剪后消息) |

### 5.6 advanced_rag/deep_research.py

| 类/方法 | 输入 | 输出 |
|---------|------|------|
| `DeepResearch(retriever, llm_client, max_depth?)` | 检索函数, LLM客户端 | 实例 |
| `research(question, callback?)` | 用户问题 | `list[dict]` (去重后的chunks) |

**流程**: 初始检索 → 充分性检查 → 不足则生成追问 → 并行检索 → 递归直到充分或达到max_depth

### 5.7 embedder.py

| 类/方法 | 输入 | 输出 |
|---------|------|------|
| `Embedder(api_key?, base_url?, model?)` | 配置参数或环境变量 | 实例 |
| `embed_texts(texts, batch_size?, max_tokens?)` | 文本列表 | `list[list[float]]` (1024维) |
| `embed_query(text)` | 查询字符串 | `list[float]` |
| `dim` | - | `int` (维度) |

- BGE 模型查询时自动添加 instruction prefix
- 超长文本自动截断到 510 tokens（BGE 限制 512）

**环境变量**: `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`

### 5.8 vector_store.py

| 类/方法 | 输入 | 输出 |
|---------|------|------|
| `VectorStore(chroma_path?, collection_name?)` | 路径和名称 | 实例 |
| `add_chunks(doc_id, chunks, embeddings, metadata_list?)` | 文档数据 | `int` (入库数) |
| `search(query_embedding, top_k?, where?)` | 向量, 参数 | `list[dict]` |
| `delete_by_doc(doc_id)` | 文档ID | `int` |
| `count()` | - | `int` |

- 使用 cosine 相似度
- 自动分批入库（每批 500 条）

### 5.9 retriever.py

| 类/方法 | 输入 | 输出 |
|---------|------|------|
| `HybridRetriever(vector_store, embedder, vector_top_k?, bm25_top_k?, rrf_k?)` | 组件实例 | 实例 |
| `rebuild_bm25()` | - | None（从 ChromaDB 重建 BM25 索引）|
| `retrieve(query, top_k?)` | 查询字符串 | `list[dict]` (含 rrf_score) |

- Vector 检索 + BM25 关键词检索 → RRF 融合排序
- 中文分词：按字符 bigram

### 5.10 reranker.py

| 类/方法 | 输入 | 输出 |
|---------|------|------|
| `Reranker(api_key?, base_url?, model?)` | 配置参数或环境变量 | 实例 |
| `rerank(query, documents, top_k?)` | 查询, 文档列表 | `list[dict]` (index, relevance_score, text) |

**环境变量**: `RERANKER_API_KEY`, `RERANKER_BASE_URL`, `RERANKER_MODEL`

### 5.11 qa_chain.py

| 类/方法 | 输入 | 输出 |
|---------|------|------|
| `QAChain(retriever, embedder, reranker, llm, retrieve_top_k?, rerank_top_k?)` | 组件实例 | 实例 |
| `async answer(question)` | 问题字符串 | `dict` (question, answer, sources, num_retrieved, num_reranked) |

- 流程: retrieve(top-20) → rerank(top-5) → build context → LLM generate
- 回答包含引用标注 [序号]

### 5.12 manager.py

| 类/方法 | 输入 | 输出 |
|---------|------|------|
| `PipelineManager(chroma_path?)` | ChromaDB 路径 | 实例 |
| `ingest_pdf(pdf_path, doc_id?)` | PDF路径 | `dict` (doc_id, num_chunks, status) |
| `async query(question)` | 问题字符串 | `dict` (question, answer, sources, ...) |
| `delete_document(doc_id)` | 文档ID | `bool` |
| `list_stats()` | - | `dict` (total_chunks) |

---

## 6. 完整数据流

```
┌───────────── 上传流程 ─────────────┐
│ PDF → MinerU API → content_list    │
│   → mineru_adapter → sections      │
│   → laws_chunker → chunks          │
│   → embedder → vectors (1024d)     │
│   → ChromaDB (cosine) 入库         │
│   → rebuild_bm25()                 │
└────────────────────────────────────┘

┌───────────── 查询流程 ─────────────┐
│ 用户问题                            │
│   → embedder → query_vector        │
│   → vector_store.search (Top-20)   │
│   → BM25.search (Top-20)           │
│   → RRF融合 (Top-15)              │
│   → reranker (Top-5)              │
│   → LLM 生成回答 + 引用 [序号]     │
└────────────────────────────────────┘
```

---

## 7. 环境变量清单

```env
# LLM
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# Embedding (SiliconFlow)
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# Reranker (SiliconFlow)
RERANKER_API_KEY=sk-xxx
RERANKER_BASE_URL=https://api.siliconflow.cn/v1
RERANKER_MODEL=BAAI/bge-reranker-v2-m3

# MinerU
MINERU_API_TOKEN=xxx
MINERU_BASE_URL=https://mineru.net/api/v4

# ChromaDB
CHROMA_PATH=./data/chroma
```

---

## 8. 测试文件

| 文件 | 测试内容 | 状态 |
|------|---------|------|
| mvp_core.py | token_utils + llm_client | ✅ |
| mvp_chunking.py | patterns → detector → tree_merge → laws_chunker → naive_chunker | ✅ |
| mvp_prompts.py | 模板加载 + keyword_extraction + sufficiency_check + multi_queries_gen | ✅ |
| mvp_deep_research.py | DeepResearch 迭代检索 | ✅ |
| mvp_e2e_parse.py | 端到端 PDF 解析 + 分块 | ✅ |
| mvp_rag_full.py | 完整 RAG: PDF入库 → 检索 → 重排 → 问答 | ✅ |

---

## 9. 关联文档

- 集成规划：[/docs/ragflow_rag_integration_plan.md](ragflow_rag_integration_plan.md)
- MinerU API 规范：[/docs/mineru_specification-v1.0.md](mineru_specification-v1.0.md)
- ragflow 源码：`/home/binma/ragflow/rag/`
- 项目总方案：[/方案.md](../方案.md)
