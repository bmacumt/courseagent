# 规划：将 Ragflow rag/ 能力集成到隧道工程智能体系统

## Context

用户正在构建"隧道工程课程智能体"系统（FastAPI + SQLite + ChromaDB + MinerU），目前 RAG 只用了 MinerU 做 PDF 解析 + LangChain 简单分块（chunk_size=500）。ragflow 的 `rag/` 模块包含大量高价值能力，但与 ragflow 框架强耦合。本规划提取这些能力、去除所有 ragflow 依赖，集成到用户的独立系统中。

**范围**：聚焦 T1（结构化分块）+ T2（提示词模板）+ T3（深度检索），工期约 5-8 天。

## MinerU 输出与分块对接（关键设计点）

MinerU 的 `content_list.json` 提供结构化数据，这是分块输入源：

```
content_list.json 每个块：
- type: "text" | "table" | "image"
- text_level: int | 缺失  （有值=标题，缺失=正文）
- text: "内容..."
- page_idx: int
- bbox: [x0, y0, x1, y1]
```

**laws_chunker 对接方案**：两层策略结合
1. **优先用 `text_level`**：MinerU 已识别标题层级（1/2/3/...），可直接用于构建层级树
2. **回退到 `BULLET_PATTERN`**：当 `text_level` 不可靠时（如扫描件 OCR），用正则匹配 "第X章/节/条" 自动检测

```python
def mineru_to_sections(content_list: list[dict]) -> list[tuple[str, str]]:
    """将 MinerU content_list 转为 tree_merge 需要的 sections 格式"""
    sections = []
    for block in content_list:
        if block["type"] == "text":
            layout = "title" if block.get("text_level") is not None else ""
            sections.append((block["text"].strip(), layout))
        elif block["type"] == "table":
            sections.append((block["table_body"], "table"))
    return sections
```

---

## 不提取的模块

- **rag/llm/** — 用户已有 model_factory.py，ragflow 版本依赖 litellm/dashscope 等大量 SDK
- **rag/graphrag/** — 依赖 ES + NetworkX + Redis，教学系统暂不需要知识图谱
- **rag/app/naive.py** — 重度依赖 deepdoc/LLMBundle，用户已有 MinerU
- **rag/raptor.py** — 后期可选，优先级低

---

## 依赖替换总表

| Ragflow 依赖 | 用途 | 替换方案 |
|---|---|---|
| `common.token_utils.num_tokens_from_string` | token 计数 | 自建 tiktoken 包装（~20行） |
| `common.token_utils.truncate` | 文本截断 | 同上模块 |
| `deepdoc.parser.*` | PDF 解析 | MinerU API（已有） |
| `api.db.services.llm_service.LLMBundle` | LLM 调用 | 自建 async OpenAI client |
| `rag.nlp.rag_tokenizer` (infinity) | 中文分词 | jieba 或简单 split（ChromaDB 不需要 content_ltks） |
| `common.constants.ParserType` | 解析器枚举 | 字符串常量 |
| Elasticsearch | 向量+全文存储 | ChromaDB + BM25（已有） |

---

## 目标目录结构

项目根目录为 `/home/binma/courseagent/`，修改集中在 `pipelines/03_rag/`：

```
pipelines/03_rag/
  app/
    core/
      token_utils.py          # 自建 tiktoken 包装
      llm_client.py           # async OpenAI/DeepSeek 封装
    chunking/                  # T1: 结构化分块
      __init__.py
      patterns.py              # BULLET_PATTERN, not_bullet()
      detector.py              # bullets_category(), is_chinese(), is_english()
      tree_merge.py            # Node 类, tree_merge(), remove_contents_table()
      laws_chunker.py          # 法规风格 chunk() 入口（对接 MinerU）
      naive_chunker.py         # 简单合并回退
      mineru_adapter.py        # content_list → sections 转换
    prompts/                   # T2: 提示词模板
      __init__.py
      loader.py                # .md 模板加载 + jinja2 渲染
      generator.py             # keyword_extraction, sufficiency_check 等
      templates/
        ask_summary.md
        citation.md
        keyword_extraction.md
        multi_queries_gen.md
        sufficiency_check.md
    advanced_rag/              # T3: 深度检索
      __init__.py
      deep_research.py         # 迭代检索 + 充分性检查
    nlp/                       # NLP 基础工具
      __init__.py
      text_utils.py            # is_chinese, is_english, find_codec
      numeral.py               # index_int 数字转换
    # 以下已有文件不变
    embedder.py
    vector_store.py
    retriever.py
    reranker.py
    qa_chain.py
    manager.py
```

---

## 实施步骤

### Phase A: 基础设施（1天）

**步骤 1** — 创建 `core/token_utils.py`
- 来源：替换 `common/token_utils.num_tokens_from_string`
- 实现：用 tiktoken `cl100k_base` 编码
- 导出：`num_tokens_from_string(text) -> int`, `truncate(text, max_tokens) -> str`
- 验证：`num_tokens_from_string("隧道工程设计规范")` 返回正整数

**步骤 2** — 创建 `core/llm_client.py`
- 来源：替换 `LLMBundle`
- 实现：async 封装 `openai.AsyncOpenAI`，支持 DeepSeek/OpenAI 兼容接口
- 导出：`async_chat(system, messages, gen_conf) -> str`
- 验证：调用 DeepSeek API 获得响应

### Phase B: T1 法规风格结构化分块（2-3天）

**步骤 3** — 创建 `chunking/patterns.py`
- 来源：`/home/binma/ragflow/rag/nlp/__init__.py` 第169-213行
- 提取：`BULLET_PATTERN`（5组编号模式）、`not_bullet()`
- **零 ragflow 依赖**，直接复制
- 约 40 行
- 验证：`BULLET_PATTERN[0]` 的正则匹配 "第3章 隧道支护设计"

**步骤 4** — 创建 `chunking/detector.py`
- 来源：`/home/binma/ragflow/rag/nlp/__init__.py` 第216-265行
- 提取：`bullets_category()`, `is_chinese()`, `is_english()`
- **零 ragflow 依赖**，直接复制
- 约 50 行
- 验证：`bullets_category(["第3章 支护", "第3.2节 锚杆"])` 返回正确模式索引

**步骤 5** — 创建 `chunking/tree_merge.py`
- 来源：`/home/binma/ragflow/rag/nlp/__init__.py` 第847-977行, 1498-1577行
- 提取：
  - `Node` 类（第1498-1577行）— **完全独立**，零依赖
  - `not_title()`（第923-928行）
  - `tree_merge()`（第931-977行）— 去掉 `rag_tokenizer` 用法
  - `remove_contents_table()`（第847-876行）
  - `make_colon_as_title()`（第879-898行）
- 依赖：仅 `chunking/patterns.py` 和 `core/token_utils.py`
- 约 200 行
- 验证：输入工程规范文本，输出 chunk 包含完整层级标题路径

**步骤 6** — 创建 `chunking/mineru_adapter.py`
- **新建**，不是从 ragflow 提取
- 功能：将 MinerU 的 `content_list.json` 转为 `tree_merge` 需要的 `sections` 格式
- 核心逻辑：
  ```python
  def mineru_to_sections(content_list: list[dict]) -> list[tuple[str, str]]:
      """(text, layout_type) 列表"""
      sections = []
      for block in content_list:
          if block["type"] == "text":
              layout = "title" if block.get("text_level") is not None else ""
              sections.append((block["text"].strip(), layout))
          elif block["type"] == "table":
              sections.append((block["table_body"], "table"))
      return sections
  ```
- 约 30 行
- 验证：MinerU 输出的 content_list 转换后 sections 格式正确

**步骤 7** — 创建 `chunking/laws_chunker.py`
- 来源：`/home/binma/ragflow/rag/app/laws.py` 的 `chunk()` 函数
- 改编：
  - PDF：MinerU content_list → `mineru_adapter.mineru_to_sections()` → `tree_merge`
  - DOCX：python-docx 提取段落 → `tree_merge`
  - TXT：直接读取按行分割 → `tree_merge`
- 核心：调用 `bullets_category()` 自动检测编号模式 → `tree_merge()` 构建层级树
- 依赖：`chunking/tree_merge.py`, `chunking/mineru_adapter.py`, MinerU API
- 约 100 行
- 验证：上传 JTG D70 规范 PDF，chunk 遵循条款边界

**步骤 8** — 创建 `chunking/naive_chunker.py`
- 来源：`/home/binma/ragflow/rag/nlp/__init__.py` 第1070-1126行 `naive_merge()`
- 改动：去掉 `RAGFlowPdfParser.remove_tag` 调用
- 约 40 行
- 验证：非结构化文档正常分块

**步骤 9** — 集成到 `02_mineru` pipeline
- 修改 `02_mineru/splitter.py`：根据文档类型选择 `laws_chunker` 或 `naive_chunker`
- 验证：端到端 PDF → MinerU 解析 → laws 分块 → 输出正确

### Phase C: T2 提示词模板（1-2天）

**步骤 10** — 创建 `prompts/loader.py`
- 来源：`/home/binma/ragflow/rag/prompts/template.py`
- 实现：`load_prompt(name)` 读取 .md 文件 + jinja2 渲染
- 约 25 行
- 验证：模板加载并渲染成功

**步骤 11** — 复制提示词模板
- 来源：`/home/binma/ragflow/rag/prompts/` 目录
- 复制：`ask_summary.md`, `citation_prompt.md`, `keyword_prompt.md`, `question_prompt.md`, `multi_queries_gen.md`, `sufficiency_check.md`
- **直接复制无需修改**（纯文本模板）
- 注意：保留 Apache 2.0 许可声明

**步骤 12** — 创建 `prompts/generator.py`
- 来源：`/home/binma/ragflow/rag/prompts/generator.py`
- 提取：`message_fit_in()`, `keyword_extraction()`, `question_proposal()`, `sufficiency_check()`, `multi_queries_gen()`
- 改动：`LLMBundle` 参数 → `core/llm_client.py` 的 async client
- 约 150 行
- 验证：`keyword_extraction(client, text)` 返回关键词

**步骤 13** — 更新 `qa_chain.py`
- 使用 `load_prompt("ask_summary")` 替换硬编码提示词
- 添加引用格式 `load_prompt("citation")`
- 验证：QA 回答包含 `[ID:X]` 引用

### Phase D: T3 深度检索（1-2天）

**步骤 14** — 创建 `advanced_rag/deep_research.py`
- 来源：`/home/binma/ragflow/rag/advanced_rag/tree_structured_query_decomposition_retrieval.py`
- 改编为 `DeepResearch` 类：
  ```python
  class DeepResearch:
      def __init__(self, retriever, llm_client, max_depth=3): ...
      async def research(self, question: str) -> list[Chunk]: ...
  ```
- 替换：`LLMBundle` → llm_client, 去掉 Tavily/KG, 用 T2 的 `sufficiency_check`
- 约 100 行
- 验证：复杂问题触发多轮检索，充分性检查正常工作

### Phase E: NLP 工具（0.5天，可穿插在 B-C 之间）

**步骤 15** — 创建 `nlp/text_utils.py`
- 提取：`is_chinese`, `is_english`, `find_codec`
- 约 40 行

**步骤 16** — 创建 `nlp/numeral.py`
- 提取：`index_int`，依赖 `cn2an`, `word2number`, `roman_numbers`
- 约 20 行

---

## 新增依赖

| 包 | 用途 | 必需步骤 |
|---|---|---|
| `tiktoken` | token 计数 | Phase A |
| `jinja2` | 模板渲染 | Phase C |
| `jieba` | 中文分词（ChromaDB 入库时可能用到） | Phase B |
| `cn2an` | 中文数字转换 | Phase E |
| `chardet` | 编码检测 | Phase E |

---

## 构建顺序

```
A(基础设施,1天)
  → B(分块,2-3天) + E(NLP工具,0.5天)    ← 可并行
    → C(提示词,1-2天)
      → D(深度检索,1-2天)
```

总工期约 5-8 天。

---

## 验证方式

每个 Phase 完成后：
1. **单元测试**：每个新模块有独立测试（用工程规范样本文本）
2. **集成测试**：上传 JTG D70 规范 PDF，端到端验证：MinerU 解析 → laws 分块 → ChromaDB 入库 → 检索 → 问答
3. **回归测试**：确保原有 BM25 + 向量 + RRF 检索链路不受影响

---

## 关键源文件索引

| 用途 | 文件路径 | 关键行号 |
|------|---------|---------|
| 编号正则模式 | `/home/binma/ragflow/rag/nlp/__init__.py` | 169-213 |
| 自动检测编号类型 | 同上 | 216-233 |
| 中英文检测 | 同上 | 236-265 |
| 去目录页 | 同上 | 847-876 |
| 冒号标题检测 | 同上 | 879-898 |
| 树形合并 | 同上 | 931-977 |
| 简单合并 | 同上 | 1070-1126 |
| Node 类 | 同上 | 1498-1577 |
| 法规分块入口 | `/home/binma/ragflow/rag/app/laws.py` | chunk() 函数 |
| 提示词模板 | `/home/binma/ragflow/rag/prompts/*.md` | — |
| 提示词生成器 | `/home/binma/ragflow/rag/prompts/generator.py` | — |
| 深度检索 | `/home/binma/ragflow/rag/advanced_rag/tree_structured_query_decomposition_retrieval.py` | — |
| MinerU 输出格式 | `/home/binma/courseagent/docs/mineru_specification-v1.0.md` | 第3节 |
