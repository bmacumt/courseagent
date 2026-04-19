# CourseAgent

CourseAgent 是一个智能课程管理与评分系统，利用先进的 AI 技术为教育工作者和学生提供全面的课程管理解决方案。

## 项目概述

CourseAgent 旨在简化和自动化课程管理流程，包括作业提交、自动评分、知识库管理和学生进度跟踪。

## 主要功能

### 1. 用户认证与权限管理
- 多角色支持：学生、教师、管理员
- JWT 令牌认证
- 基于角色的访问控制

### 2. RAG（检索增强生成）系统
- 文档解析与分块
- 向量存储与语义搜索
- 智能问答系统
- 法规文档处理

### 3. 自动评分系统
- 多维度评分标准
- AI 驱动的答案评估
- 详细反馈生成
- 法规符合性检查

### 4. 前后端分离架构
- 现代化的 React 前端
- FastAPI 后端服务
- RESTful API 设计

## 项目结构

```
courseagent/
├── frontend/          # React 前端应用
├── backend/          # 后端服务
├── pipelines/        # 核心处理管道
│   ├── 01_auth/     # 认证模块
│   ├── 03_rag/      # RAG 系统
│   ├── 04_grading/  # 评分系统
│   └── 05_backend/  # 后端服务
├── docs/            # 项目文档
└── 方案.md          # 详细技术方案
```

## 技术栈

### 前端
- React 18 + TypeScript
- Vite 构建工具
- Tailwind CSS
- Shadcn/ui 组件库

### 后端
- Python 3.12+
- FastAPI
- SQLAlchemy
- PostgreSQL

### AI/ML
- OpenAI API
- LangChain
- ChromaDB（向量数据库）
- 自定义 RAG 管道

## 快速开始

### 环境要求
- Python 3.12+
- Node.js 18+
- PostgreSQL 15+
- Redis（可选）

### 安装步骤

1. 克隆仓库：
```bash
git clone https://github.com/bmacumt/courseagent.git
cd courseagent
```

2. 设置 Python 环境：
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

3. 设置前端：
```bash
cd frontend
npm install
npm run dev
```

4. 配置环境变量：
```bash
cp pipelines/01_auth/.env.example pipelines/01_auth/.env
cp pipelines/03_rag/.env.example pipelines/03_rag/.env
# 编辑 .env 文件，添加必要的 API 密钥和配置
```

5. 启动后端服务：
```bash
cd pipelines/05_backend
uvicorn server.main:app --reload
```

## 使用说明

### 教师功能
- 创建和管理课程
- 上传教学材料
- 布置作业和评分标准
- 查看学生提交和评分
- 管理知识库

### 学生功能
- 查看课程和作业
- 提交作业答案
- 查看评分和反馈
- 使用智能问答系统
- 跟踪学习进度

### 管理员功能
- 用户管理
- 系统配置
- 数据统计和分析
- 系统监控

## 开发指南

### 代码规范
- 使用 Black 进行 Python 代码格式化
- 使用 ESLint 和 Prettier 进行前端代码格式化
- 遵循 Git 提交规范

### 测试
```bash
# 运行 Python 测试
pytest

# 运行前端测试
cd frontend
npm test
```

### 部署

#### Docker 部署
```bash
docker-compose up -d
```

#### 云部署
- 支持部署到 AWS、Azure、GCP
- 提供 Kubernetes 配置
- 支持 CI/CD 流水线

