# 04_grading — 评分智能体 Pipeline 技术文档

## 1. 概述

多维度综合评分智能体。通过 RAG 检索规范条文辅助评分，老师可自定义评分维度和权重，总分由后端计算（非 LLM）。

---

## 2. 技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| LLM | DeepSeek API (OpenAI 兼容) | 维度评分、规范验证、评语生成 |
| RAG 检索 | 03_rag Pipeline (subprocess) | 规范条文检索与重排序 |
| 数据模型 | Pydantic v2 | 结构化输入输出 |
| 提示词 | jinja2 模板 | 维度评分、规范验证、综合评语 |
| JSON 解析 | json + json_repair | LLM 输出解析 |

## 3. 虚拟环境

- **路径**: `/pipelines/04_grading/.venv`
- **Python**: 3.12
- **工具**: uv
- **安装依赖**:
  ```bash
  uv pip install openai tiktoken chromadb rank-bm25 pydantic python-dotenv jinja2 json-repair requests httpx --python .venv/bin/python
  ```

## 4. 目录结构

```
04_grading/
├── .venv/
├── .env                          # LLM + Embedding + Reranker + ChromaDB 配置
├── .env.example
├── CLAUDE.md
├── data/
├── mvp_test.py                   # 5 项 MVP 测试
└── app/
    ├── __init__.py
    ├── models.py                 # Pydantic 模型: DimensionConfig, GradingCriteria, GradingReport
    ├── rag_bridge.py             # RAG 桥接: subprocess 调用 03_rag
    ├── scorer.py                 # 评分器: score_dimension, check_regulations, generate_feedback
    ├── agent.py                  # 评分智能体: GradingAgent.grade()
    └── prompts/
        ├── dimension_score.md    # 维度评分提示词
        ├── regulation_check.md   # 规范验证提示词
        └── summary.md            # 综合评语提示词
```

---

## 5. 评分模型

### 5.1 默认维度（老师可覆盖）

| 维度 | 权重 | 说明 |
|------|------|------|
| 准确性 (accuracy) | 30% | 内容是否正确，技术要点是否准确 |
| 完整性 (completeness) | 25% | 是否覆盖题目要求的所有要点 |
| 规范性 (compliance) | 25% | 是否引用相关规范标准 |
| 创新性 (innovation) | 20% | 是否有自己的思考或独特见解 |

### 5.2 规范性评分逻辑

- 检索到规范 **且** 学生引用 → 规范性高分
- 检索到规范 **但** 学生未引用 → 不加分但不一定低分
- **未检索到**相关规范 → 跳过规范验证，其他维度正常评分

### 5.3 评分流程

```
题目 + 学生答案 + 评分标准
  ↓
Step 1: RAG 检索 — 从知识库检索相关规范条文
  ↓
Step 2: 逐维度评分 — LLM 对每个维度独立评分(0-100)
  ↓
Step 3: 规范验证 — 检查学生答案是否引用了检索到的规范
  ↓
Step 4: 后端汇总 — 按权重加权计算总分（Python 算术，非 LLM）
  ↓
Step 5: 生成评语 — LLM 生成综合评语
```

---

## 6. 模块输入输出

### 6.1 models.py

| 模型 | 说明 |
|------|------|
| `DimensionConfig` | 维度配置: name, label, weight, description |
| `GradingCriteria` | 评分标准: dimensions, reference_answer, max_score, extra_instructions |
| `DimensionResult` | 维度结果: name, label, score(0-100), weight, weighted_score, comment |
| `GradingReport` | 最终报告: total_score, dimensions, feedback, references, regulations |

### 6.2 rag_bridge.py

通过 subprocess 调用 03_rag 的 Python，避免 `app` 包名冲突。

| 方法 | 输入 | 输出 |
|------|------|------|
| `retrieve_regulations(topic, top_k)` | 查询主题 | `list[dict]` (text, relevance_score) |
| `ingest_pdf(pdf_path)` | PDF 路径 | `dict` (doc_id, num_chunks, status) |

### 6.3 scorer.py

| 函数 | 说明 |
|------|------|
| `score_dimension(llm, dimension, question, answer, ...)` | LLM 对单维度评分 |
| `check_regulations(llm, question, answer, regulations)` | 检查规范引用 |
| `generate_feedback(llm, question, answer, results, ...)` | 生成综合评语 |

### 6.4 agent.py

```python
class GradingAgent:
    def __init__(rag_bridge, llm?): ...
    async def grade(question, student_answer, criteria?) -> GradingReport
```

---

## 7. 输出格式

```json
{
  "total_score": 88.8,
  "max_score": 100,
  "dimensions": [
    {"name": "accuracy", "label": "准确性", "score": 85, "weight": 0.3, "weighted_score": 25.5, "comment": "..."},
    {"name": "completeness", "label": "完整性", "score": 90, "weight": 0.25, "weighted_score": 22.5, "comment": "..."},
    {"name": "compliance", "label": "规范性", "score": 95, "weight": 0.25, "weighted_score": 23.75, "comment": "..."},
    {"name": "innovation", "label": "创新性", "score": 85, "weight": 0.2, "weighted_score": 17.0, "comment": "..."}
  ],
  "feedback": "综合评语...",
  "references": ["引用的规范条文..."],
  "regulations_found": ["检索到的规范..."],
  "regulations_cited": ["学生引用的规范..."]
}
```

---

## 8. 测试结果

| 测试 | 结果 |
|------|------|
| Test 1: 总分计算 | ✅ 75.0 正确 |
| Test 2: 好答案评分 | ✅ 88.8/100，规范引用被识别 |
| Test 3: 差答案评分 | ✅ 11.0/100，低分正确 |
| Test 4: 自定义维度 | ✅ 85/100，2 维度正常 |
| Test 5: 无规范匹配 | ✅ 48.5/100，不崩溃 |

---

## 9. 关联文档

- 项目总方案：[/方案.md](../方案.md)
- RAG Pipeline：`/home/binma/courseagent/pipelines/03_rag/`
- 根 CLAUDE.md：`/home/binma/courseagent/CLAUDE.md`
