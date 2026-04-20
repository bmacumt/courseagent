# 隧道工程课程智能体平台

基于 RAG + LLM 的隧道工程教学辅助系统，支持作业智能评改、知识问答、能力画像。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + Vite + Recharts |
| 后端 | Python 3.12 + FastAPI + SQLAlchemy (async) |
| 数据库 | SQLite + ChromaDB（向量） |
| AI | DeepSeek（LLM）/ SiliconFlow（Embedding + Reranker）/ MinerU（PDF 解析） |

## 项目结构

```
courseagent/
├── backend/                # 后端服务（FastAPI）
│   ├── app/
│   │   ├── api/            # 路由层（admin/teacher/student/auth）
│   │   ├── auth/           # JWT 认证
│   │   ├── db/             # 数据库模型 & 引擎
│   │   ├── services/       # 业务逻辑
│   │   │   ├── rag/        # RAG 管线（检索 + 问答）
│   │   │   ├── grading/    # 评分智能体
│   │   │   ├── profile_service.py   # 学伴能力画像
│   │   │   └── rag_service.py       # RAG 服务门面
│   │   └── main.py         # 入口
│   ├── requirements.txt
│   └── .env.example
├── frontend/               # 前端（React + TypeScript）
│   ├── src/app/
│   │   ├── api/            # API 层
│   │   ├── pages/          # 页面组件（admin/teacher/student）
│   │   ├── components/     # 共享组件
│   │   └── context/        # Auth 上下文
│   └── package.json
├── pipelines/              # 开发期各模块独立管线（参考用）
└── docs/                   # 项目文档
```

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+ & pnpm
- uv（Python 包管理，可选）

### 1. 后端

> **系统依赖**：需要安装 `ffmpeg`（用于视频文件转写入库）。Ubuntu: `sudo apt install ffmpeg`，macOS: `brew install ffmpeg`。

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少修改 SECRET_KEY

# 启动
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

首次启动会自动：
- 初始化 SQLite 数据库
- 创建默认测试账号
- 同步模型配置

### 2. 前端

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 http://localhost:5173

### 3. 配置模型

后端启动后，登录管理员账号 → 侧边栏「模型管理」：

1. 添加提供商（如 DeepSeek），填入 API Key 和 Base URL
2. 配置各类型模型（chat / embedding / rerank）并设为默认
3. 点击「验证」确认连通

模型配置存储在数据库中，无需手动编辑配置文件。

### 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 教师 | teacher1 | teacher123 |
| 学生 | student1 | student123 |

## 功能概览

### 管理员
- 用户管理（增删改、批量导入学生）
- 知识库浏览
- 作业 & 提交管理
- 模型配置（API Key、模型选择）
- 学伴分析（查看所有学生能力画像）

### 教师
- 知识库管理（上传文档、解析、查看分块）
- 作业管理（创建、发布、设置评分维度）
- 提交查看 & 评分报告 & CSV 导出
- 学伴分析（查看本班学生能力画像）

### 学生
- 作业查看 & 提交
- 评分报告查看（多维度得分、AI 反馈）
- 知识问答（RAG 增强问答，支持流式输出）
- 功能模块：报告诊断 / 全程学伴 / 课业评分 / 专业问答
- 能力画像（雷达图、成绩趋势、AI 学习建议）

## 部署

参见 [docs/deployment.md](docs/deployment.md)，推荐 Docker Compose + Nginx 方案。
