# 隧道工程课程智能体 — 产品需求文档（PRD）

> **版本：** v1.0
> **日期：** 2026-04-18
> **关联文档：**
> - 后端服务规范：`docs/backend_service_specification-v0.0.md`
> - 前端设计规范：`docs/frontend_design_specification-v0.0.md`

---

## 1. 项目概述

### 1.1 项目背景

隧道工程是公路工程领域的核心专业课，涉及大量国家规范和行业标准（如 JTG 系列标准）。传统的作业评改流程面临以下问题：

- **教师批改负担重** — 每次作业需逐份阅读、对比规范、给出评语，一位教师面对 50-100 名学生时，批改周期长、反馈滞后
- **评分主观性强** — 不同教师对同一答案的评分标准不一致，学生体验不公平
- **规范引用难以核查** — 学生答题是否正确引用了相关行业标准，教师需逐条对照，费时费力
- **缺乏即时反馈** — 学生提交后需等待数天甚至数周才能收到评语，错失最佳学习窗口
- **知识问答资源有限** — 学生在课后复习时遇到疑问，缺乏即时答疑渠道

### 1.2 产品定位

**一款面向高校隧道工程课程的 AI 辅助教学平台**，通过 RAG（检索增强生成）+ LLM（大语言模型）技术，实现：

1. **AI 自动评分** — 基于知识库中的规范条文，对学生答案进行多维度智能评分，秒级出报告
2. **规范引用验证** — 自动检索并核实学生答案中对行业规范的引用情况
3. **知识问答** — 学生可随时向 AI 提问，基于课程知识库获得准确回答
4. **教学管理** — 教师可上传知识库、发布作业、查看评分报告，管理员可管理用户和系统配置

### 1.3 核心目标

| 目标 | 衡量指标 |
|------|---------|
| 减轻教师批改负担 | AI 评分替代 80% 以上的初轮批改工作 |
| 保证评分客观一致 | 同一答案多次评分波动 < 5 分 |
| 加速学生反馈 | 提交后 60 秒内获得评分报告 |
| 提升学习效率 | 知识问答平均响应 < 10 秒，引用准确率 > 85% |

### 1.4 用户群体

| 角色 | 人数规模 | 核心诉求 | 使用设备 |
|------|---------|---------|---------|
| **管理员** | 1-2 人 | 管理用户账号、监控系统运行状态、配置 API 参数 | 桌面端 |
| **教师** | 3-10 人 | 上传课程规范、发布作业、查看 AI 评分报告、了解学生掌握情况 | 桌面端为主 |
| **学生** | 50-200 人 | 查看作业、提交答案、查看评分反馈、知识问答 | 桌面端 + 移动端 |

### 1.5 核心业务场景

**场景一：教师发布作业 → 学生作答 → AI 自动评分**

> 张老师上传了《JTG 1001-2017 公路工程标准体系》到知识库，创建了一道关于"标准体系总体框架"的作业题，设置了准确性、完整性、规范性、创新性四个评分维度，然后发布。
>
> 50 名学生陆续提交答案。每份答案提交后，系统自动：从知识库检索相关规范 → 逐维度评分 → 验证规范引用 → 计算加权总分 → 生成综合评语。
>
> 张老师打开作业详情，看到 50 份答案的评分报告，包括每人的维度得分、评语和规范引用情况。平均分 72.3 分，规范性维度得分最低（平均 45 分），说明学生对规范引用普遍薄弱，下次课重点讲解。

**场景二：学生课后复习 → 知识问答**

> 王同学在复习时想确认"公路建设板块包含哪些模块"，打开系统的知识问答功能提问。系统从知识库检索到 JTG 1001-2017 的相关条文，生成准确回答并附上引用来源。王同学确认了 8 个模块的具体名称，继续下一轮复习。

**场景三：管理员批量导入新生**

> 新学期开始，管理员通过批量导入功能，一次性创建 60 名新生的账号（含姓名、学号、班级），2 分钟完成全部注册。导入结果清晰展示：成功 58 人、失败 2 人（学号重复），可直接定位问题。

---

## 2. 产品流程

### 2.1 整体业务流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                        系统初始化阶段                                 │
│                                                                     │
│  管理员登录 → 创建教师账号 → 创建/批量导入学生账号                    │
│                                                                     │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        教学准备阶段                                   │
│                                                                     │
│  教师登录 → 上传 PDF 规范到知识库（MinerU解析→分块→嵌入→入库）        │
│          → 创建作业（设置题目、评分标准、截止时间）                    │
│          → 发布作业                                                  │
│                                                                     │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        学生作答阶段                                   │
│                                                                     │
│  学生登录 → 查看已发布作业列表                                       │
│         → 进入答题页面，撰写答案                                     │
│         → 提交答案（可覆盖重交）                                     │
│                                                                     │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AI 自动评分阶段（异步）                          │
│                                                                     │
│  提交触发后台任务 → RAG 检索知识库中相关规范条文                      │
│                 → 4 维度并行 LLM 评分（准确性/完整性/规范性/创新性） │
│                 → LLM 验证规范引用                                   │
│                 → 后端 Python 按权重加权计算总分                      │
│                 → LLM 生成综合评语                                   │
│                 → 持久化评分报告                                     │
│                 → 更新提交状态为"已评分"                              │
│                                                                     │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        结果查看阶段                                   │
│                                                                     │
│  学生：查看评分报告（总分、维度得分、评语、规范引用）                  │
│  教师：查看全部学生的提交列表、评分报告、分数分布                      │
│  管理员：查看系统统计数据                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 用户生命周期流程

#### 2.2.1 管理员流程

```
登录
  │
  ├──→ 系统概览 Dashboard（查看统计数据）
  │
  ├──→ 用户管理
  │     ├── 新增单个用户（填写用户名/密码/角色/姓名）
  │     ├── 批量导入学生（粘贴 CSV 或逐行填写 → 提交 → 查看导入结果）
  │     ├── 筛选用户列表（按角色/班级）
  │     ├── 编辑用户信息（修改姓名/密码/班级）
  │     └── 删除用户（二次确认）
  │
  └──→ 系统配置
        ├── 切换分类标签（LLM / Embedding / Reranker / MinerU / 通用）
        ├── 修改配置值
        └── 保存（单个配置即时保存）
```

#### 2.2.2 教师流程

```
登录
  │
  ├──→ 教学概览 Dashboard（知识库数量、进行中作业、待批改数）
  │
  ├──→ 知识库管理
  │     ├── 上传 PDF 文档（填写标题、选择类型、上传文件）
  │     │     └── 上传进度条 → 成功入库（显示分块数）
  │     ├── 查看文档列表（仅显示自己上传的）
  │     └── 删除文档（二次确认，联动清除向量数据）
  │
  ├──→ 作业管理
  │     ├── 创建作业
  │     │     ├── 填写标题、题目描述、具体题目
  │     │     ├── 可选：填写参考答案
  │     │     ├── 可选：设置截止时间
  │     │     ├── 选择评分标准（默认 4 维度 / 自定义维度和权重）
  │     │     └── 保存为草稿
  │     ├── 编辑草稿作业
  │     ├── 发布作业（二次确认：发布后不可编辑）
  │     ├── 删除草稿作业
  │     └── 查看已发布作业的提交情况
  │
  ├──→ 提交列表
  │     ├── 查看某作业下所有学生的提交状态
  │     │     （学生姓名、状态标签、提交时间、分数）
  │     └── 点击某学生 → 跳转评分报告
  │
  └──→ 评分报告
        ├── 总分圆形展示（XX / 100）
        ├── 维度条形图（各维度得分、权重、加权分）
        ├── 各维度评语（可展开/折叠）
        ├── 综合评语
        └── 规范引用（已引用 / 未引用但相关）
```

#### 2.2.3 学生流程

```
登录
  │
  ├──→ 学习概览 Dashboard（待完成作业数、已完成数、最新评分）
  │
  ├──→ 我的作业
  │     ├── 查看已发布作业列表（卡片式）
  │     │     每张卡片：标题、描述预览、教师名、截止时间、提交状态
  │     ├── 点击未提交的作业 → 进入答题页
  │     │     ├── 阅读题目要求
  │     │     ├── 撰写答案（文本区域）
  │     │     └── 提交答案（确认弹窗 → 提交成功 → 跳转提交列表）
  │     └── 点击已提交的作业 → 查看最新提交状态
  │
  ├──→ 我的提交
  │     ├── 查看所有提交记录（按时间倒序）
  │     │     每条：作业标题、提交时间、状态、分数
  │     ├── "评分中"状态的记录自动轮询刷新（每 5 秒）
  │     └── 点击已评分记录 → 跳转评分报告
  │
  ├──→ 评分报告
  │     ├── 总分圆形展示
  │     ├── 各维度得分条形图 + 评语
  │     ├── 综合评语（鼓励性 + 改进建议）
  │     └── 引用的规范名称
  │
  └──→ 知识问答
        ├── 聊天式界面
        ├── 输入问题 → AI 回答（附引用来源）
        └── 清空对话
```

### 2.3 评分流程详细时序

```
学生端                      后端                        AI 服务
  │                         │                           │
  │  POST /submit           │                           │
  │ ──────────────────────→ │                           │
  │                         │  创建 Submission          │
  │                         │  status = "submitted"     │
  │  ←──── {id, status} ── │                           │
  │                         │                           │
  │  (前端轮询提交状态)      │  BackgroundTask 触发      │
  │                         │                           │
  │                         │  status → "grading"       │
  │                         │                           │
  │                         │  RAG 检索规范条文 ────────→│ Embedding + ChromaDB
  │                         │  ←──── 相关 chunks ────── │
  │                         │                           │
  │                         │  逐维度 LLM 评分 ────────→│ DeepSeek API
  │                         │  ←──── {score, comment}── │
  │                         │  (4 个维度并行)            │
  │                         │                           │
  │                         │  规范验证 ───────────────→│ DeepSeek API
  │                         │  ←──── {cited, uncited}─ │
  │                         │                           │
  │                         │  Python 计算加权总分       │
  │                         │  (无 LLM 参与)            │
  │                         │                           │
  │                         │  生成综合评语 ───────────→│ DeepSeek API
  │                         │  ←──── feedback ──────── │
  │                         │                           │
  │                         │  持久化 Report             │
  │                         │  status → "graded"        │
  │                         │                           │
  │  GET /submissions       │                           │
  │ ──────────────────────→ │                           │
  │  ←── status="graded" ── │                           │
  │                         │                           │
  │  GET /reports/:id       │                           │
  │ ──────────────────────→ │                           │
  │  ←── 完整评分报告 ───── │                           │
```

---

## 3. 页面/模块清单

### 3.1 全局模块

| 模块 | 说明 |
|------|------|
| 登录页 | 用户名密码登录，JWT 认证，按角色跳转首页 |
| 顶栏 | 系统名称 + 当前用户信息 + 退出登录 |
| 侧边栏导航 | 按角色动态渲染菜单项，深色背景 |
| 路由守卫 | 未登录跳转登录页、角色权限校验、401 自动退出 |

### 3.2 管理员模块（3 页）

| # | 页面 | 路由 | 对应 API | 功能说明 |
|---|------|------|---------|---------|
| A1 | 系统概览 | `/admin/dashboard` | `GET /admin/stats` | 4 个统计卡片（用户数/文档数/作业数/提交数） |
| A2 | 用户管理 | `/admin/users` | `GET /POST /PUT /DELETE /admin/users*` | 用户列表（筛选/新增/编辑/删除）+ 批量导入学生 |
| A3 | 系统配置 | `/admin/settings` | `GET/PUT /admin/settings*` | 按 Tab 分类展示配置项，支持在线编辑保存 |

### 3.3 教师模块（5 页）

| # | 页面 | 路由 | 对应 API | 功能说明 |
|---|------|------|---------|---------|
| T1 | 教学概览 | `/teacher/dashboard` | `GET /teacher/assignments`, `GET /teacher/knowledge` | 统计卡片 + 最近作业 + 知识库文档列表 |
| T2 | 知识库管理 | `/teacher/knowledge` | `POST/GET/DELETE /teacher/knowledge*` | PDF 上传（拖拽）+ 文档列表 + 删除 |
| T3 | 作业管理 | `/teacher/assignments` | `POST/GET/PUT/DELETE /teacher/assignments*` | 作业列表（卡片式）+ 创建/编辑/发布/删除作业 |
| T4 | 提交列表 | `/teacher/assignments/:id/submissions` | `GET /teacher/assignments/{id}/submissions`, `GET /teacher/assignments/{id}/export` | 学生提交表格（姓名/状态/时间/分数）+ 导出成绩 CSV |
| T5 | 评分报告 | `/teacher/reports/:id` | `GET /teacher/reports/{id}` | 总分 + 维度得分条形图 + 评语 + 规范引用 |

### 3.4 学生模块（6 页）

| # | 页面 | 路由 | 对应 API | 功能说明 |
|---|------|------|---------|---------|
| S1 | 学习概览 | `/student/dashboard` | `GET /student/assignments`, `GET /student/submissions` | 待完成/已完成/评分中统计 + 最新评分 |
| S2 | 作业列表 | `/student/assignments` | `GET /student/assignments` | 已发布作业卡片（标题/描述/截止时间/提交状态） |
| S3 | 答题页 | `/student/assignments/:id/submit` | `GET /student/assignments/{id}`, `POST /student/assignments/{id}/submit` | 展示题目 + Markdown 编辑器 + 文件上传（拖拽）+ 提交按钮 |
| S4 | 我的提交 | `/student/submissions` | `GET /student/submissions` | 提交记录列表（作业名/时间/状态/分数/附件）+ 自动轮询 |
| S5 | 评分报告 | `/student/reports/:id` | `GET /student/reports/{id}` | 与教师报告同结构，评语面向学生，Markdown 渲染 |
| S6 | 知识问答 | `/student/qa` | `POST /student/qa` | 聊天式界面，提问 → AI 回答（Markdown 渲染 + 引用标注） |

### 3.5 共享组件

| 组件 | 使用场景 |
|------|---------|
| ScoreCircle | 总分圆形进度展示（T5, S5） |
| DimensionBar | 维度得分水平条形图（T5, S5） |
| StatusTag | 提交状态标签：已评(绿)/评分中(蓝)/失败(红)（T4, S4） |
| ConfirmDialog | 删除文档、发布作业、提交答案等二次确认 |
| MarkdownRenderer | Markdown 渲染展示（S3 编辑器预览、S5/S6/T5 报告和问答） |
| FileUploader | 拖拽/点击上传文件组件（S3 答题页、T2 知识库） |

---

## 4. 关键交互逻辑

### 4.1 登录与权限控制

```
用户打开系统
  │
  ├── 未登录 → 显示登录页
  │           ├── 输入用户名 + 密码
  │           ├── POST /login → 获取 JWT token
  │           ├── token 存入 localStorage + Pinia
  │           └── 按 role 跳转：
  │                 admin   → /admin/dashboard
  │                 teacher → /teacher/dashboard
  │                 student → /student/dashboard
  │
  ├── 已登录（localStorage 有 token）
  │           ├── GET /me 验证 token 有效性
  │           ├── 有效 → 进入对应角色首页
  │           └── 无效 → 清除 token → 跳转登录页
  │
  └── 路由守卫
              ├── 所有 /admin/* 路由要求 role=admin
              ├── 所有 /teacher/* 路由要求 role=teacher 或 admin
              ├── 所有 /student/* 路由要求 role=student
              └── 不匹配 → 403 提示 + 返回上一页
```

### 4.2 作业发布流程

```
教师点击"创建作业"
  │
  ├── 填写表单
  │     ├── 标题（必填）
  │     ├── 题目描述（必填，展示给学生）
  │     ├── 具体题目（必填，传给 AI 评分）
  │     ├── 参考答案（选填）
  │     ├── 截止时间（选填，datetime picker）
  │     └── 评分标准
  │           ├── 默认：准确性(30%) + 完整性(25%) + 规范性(25%) + 创新性(20%)
  │           └── 自定义：动态增删维度行，设置名称/权重/描述
  │                 └── 前端校验：权重合计必须 = 1.0
  │
  ├── 点击"创建" → POST /teacher/assignments
  │     ├── 成功 → 返回作业列表，新作业显示为"草稿"
  │     └── 失败 → 表单下方显示错误信息
  │
  └── 点击"发布" → PUT /teacher/assignments/{id}/publish
        ├── 弹出确认弹窗："发布后学生将看到此作业，不可再编辑。确定？"
        ├── 确认 → 调用 API → 成功 → 状态变为"已发布"
        └── 取消 → 关闭弹窗
```

### 4.3 学生提交与评分轮询

```
学生进入答题页（GET /student/assignments/{id} 获取题目详情）
  │
  ├── 阅读题目要求
  │
  ├── 提交答案（两种方式，可组合使用）
  │     ├── 方式一：Markdown 编辑器直接输入
  │     │     ├── 支持工具栏（加粗/标题/列表/代码块等）
  │     │     ├── 左右分栏：左侧编辑 / 右侧实时预览（MarkdownRenderer）
  │     │     └── 编辑器底部显示字数统计
  │     │
  │     └── 方式二：上传文件（拖拽或点击）
  │           ├── FileUploader 组件：拖拽区域 + 点击选择按钮
  │           ├── 支持格式：.pdf, .docx
  │           ├── 前端校验：文件大小 ≤ 10MB，格式不符时 ElMessage.warning
  │           ├── 上传后显示文件名 + 删除按钮
  │           └── 后端解析文件文本，与手输内容合并
  │
  ├── 若已有提交记录，提示"你已有提交，重新提交将覆盖评分"
  │
  ├── 点击"提交答案"
  │     ├── 弹出确认弹窗："确认提交？AI 将自动评分。"
  │     ├── POST /student/assignments/{id}/submit (multipart/form-data)
  │     │     ├── content: 手输文本（可选）
  │     │     └── file: 上传文件（可选）
  │     │     └── 至少提供一项，否则 400 错误
  │     ├── Response: {id, status: "submitted"}
  │     └── 成功 → 跳转到"我的提交"页面
  │
  └── 我的提交页面
        ├── 新提交显示状态标签"AI 评分中"（蓝色）
        ├── 若有附件，显示附件图标 + 文件名（可点击下载）
        ├── 前端启动轮询：每 5 秒 GET /student/submissions
        │     └── 检查该提交的 status 是否从 "grading" 变为 "graded"
        ├── status 变为 "graded" → 停止轮询 → 更新显示分数
        ├── status 变为 "failed" → 停止轮询 → 显示"评分失败"标签
        └── 超过 60 秒仍未完成 → 停止轮询 → 显示"评分可能需要更长时间"提示
```

### 4.4 评分报告展示

```
用户（教师或学生）打开评分报告页
  │
  ├── GET /reports/{id} 获取完整报告数据
  │
  ├── 渲染总分区域
  │     └── ScoreCircle 组件：圆形进度条，中间大字显示 85.5，下方 /100
  │
  ├── 渲染维度得分
  │     └── DimensionBar 组件（4 个）
  │           ├── 水平条形图，宽度 = score%
  │           ├── 颜色梯度：≥80 绿色、60-79 蓝色、40-59 黄色、<40 红色
  │           ├── 右侧显示分数和权重
  │           └── 点击展开显示评语
  │
  ├── 渲染综合评语
  │     └── 卡片区，MarkdownRenderer 渲染 AI 生成的评语（支持列表/加粗等格式）
  │
  └── 渲染规范引用（折叠面板）
        ├── 已引用的规范列表
        ├── 参考的规范原文摘要
        └── 教师视角额外显示：未引用但相关的规范
```

### 4.5 知识库上传

```
教师进入知识库管理页
  │
  ├── 拖拽或点击上传 PDF 文件
  │     ├── 前端校验：仅接受 .pdf 格式
  │     ├── 填写文档标题（必填）
  │     └── 选择文档类型（规范/教材/其他）
  │
  ├── 点击上传
  │     ├── POST /teacher/knowledge (multipart/form-data)
  │     ├── 显示上传进度条
  │     ├── 后端处理：MinerU 解析 → 分块 → Embedding → ChromaDB 入库
  │     └── 返回：文档 ID + 分块数量
  │
  ├── 上传成功
  │     ├── 列表新增一条文档记录
  │     └── 显示文档标题、分块数、上传时间
  │
  └── 删除文档
        ├── 点击删除按钮 → 确认弹窗："删除后向量数据将同步清除"
        ├── DELETE /teacher/knowledge/{id}
        └── 成功 → 列表移除该条记录
```

### 4.6 批量导入学生

```
管理员进入用户管理页 → 点击"批量导入"
  │
  ├── 弹出导入 Dialog
  │     ├── 方式一：文本框粘贴 CSV 格式
  │     │     每行：username,password,real_name,student_id,class_name
  │     │
  │     └── 方式二：逐行动态表单
  │           每行填写用户名/密码/姓名/学号/班级
  │           支持动态增删行
  │
  ├── 点击"导入"
  │     └── POST /admin/users/batch
  │
  └── 展示导入结果
        ├── 成功 X 人 → 绿色提示
        ├── 失败 Y 人 → 红色列表，逐条显示失败原因
        │     例："第 3 行 stu_002：学号 S001 已存在"
        └── 关闭 Dialog → 用户列表刷新
```

### 4.7 全局错误处理

| 场景 | 处理方式 |
|------|---------|
| 401 未授权 | 清除本地 token → 跳转登录页 → 提示"登录已过期" |
| 403 无权限 | 页面顶部 ElMessage.error "无权限执行此操作" |
| 400 业务错误 | 表单下方显示具体错误信息（如"学号已存在""已过截止日期"） |
| 500 服务器错误 | 全局 ElMessage.error "服务器错误，请稍后重试" |
| 网络超时 | ElMessage.warning "网络请求超时" |
| 评分失败 | 提交列表中该条记录显示红色"评分失败"标签 |

---

## 5. UI 设计规范

### 5.1 整体布局

```
┌──────────────────────────────────────────────────┐
│  顶栏 (h:64px, bg:#FFFFFF, border-bottom:1px)     │
│  [Logo 隧道工程课程智能体]          [用户名 ▼ 退出] │
├─────────┬────────────────────────────────────────┤
│         │                                        │
│ 侧边栏  │             内容区                      │
│ w:220px │   (bg:#F7F8FA, padding:24px)            │
│ bg:     │                                        │
│#2C3A47  │  面包屑 > 当前页                        │
│         │  ──────────────────                     │
│ 菜单项   │  页面标题                               │
│ (白色选中│  ──────────────────                     │
│  灰色默认│  页面内容                               │
│         │                                        │
├─────────┴────────────────────────────────────────┤
```

**响应式规则：**

| 屏幕宽度 | 侧边栏 | 内容区 | 适用设备 |
|---------|--------|--------|---------|
| ≥ 992px | 固定 220px 展开 | 自适应剩余宽度 | 桌面 |
| 768-991px | 收缩为 64px 图标模式 | 自适应 | 平板 |
| < 768px | 隐藏，汉堡按钮触发 overlay | 满宽 | 手机 |

### 5.2 配色体系

**设计原则：低饱和度、高可读性、学术专业感**

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 Primary | `#4A6FA5` | 按钮、链接、选中态 |
| 辅助色 Secondary | `#6B8F71` | 知识库相关元素 |
| 成功 Success | `#6B9E7A` | 已评分、已提交 |
| 警告 Warning | `#D4A843` | 评分中、截止提醒 |
| 危险 Danger | `#C46B6B` | 删除、失败、低分 |
| 信息 Info | `#7A8F9E` | 辅助文字、标签 |
| 页面背景 | `#F7F8FA` | 内容区底色 |
| 卡片背景 | `#FFFFFF` | 卡片、表格底色 |
| 侧边栏背景 | `#2C3A47` | 深色侧边栏 |
| 侧边栏文字 | `#A4B0BE` / `#FFFFFF` | 未选中 / 选中 |
| 主文字 | `#2C3E50` | 正文、标题 |
| 辅助文字 | `#7F8C8D` | 次要信息、时间 |
| 边框 | `#E8ECF0` | 卡片边框、分割线 |

### 5.3 字体规范

```css
font-family: -apple-system, BlinkMacSystemFont, "PingFang SC",
             "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

| 层级 | 大小 | 字重 | 用途 |
|------|------|------|------|
| 看板数字 | 28px | 600 | Dashboard 统计数字 |
| 页面标题 | 20px | 600 | 每页顶部标题 |
| 小标题 | 16px | 500 | 卡片标题、区块标题 |
| 正文 | 14px | 400 | 表格内容、描述文字 |
| 辅助文字 | 13px | 400 | 表格次列、标签 |
| 微型文字 | 12px | 400 | 时间戳、脚注 |

### 5.4 间距与圆角

| Token | 值 | 用途 |
|-------|-----|------|
| spacing-xs | 4px | 图标与文字间距 |
| spacing-sm | 8px | 元素内部间距 |
| spacing-md | 16px | 卡片内边距、元素间距 |
| spacing-lg | 24px | 区块间距、内容区 padding |
| spacing-xl | 32px | 页面级间距 |
| radius-sm | 4px | 标签、小按钮 |
| radius-md | 8px | 卡片、输入框、对话框 |
| radius-lg | 12px | 大面板 |

### 5.5 核心组件样式

**卡片（Card）**
- 白色背景，1px `#E8ECF0` 边框，8px 圆角
- 阴影：`0 1px 3px rgba(0,0,0,0.04)`（极轻微）
- 内边距：16px-24px

**按钮（Button）**
- 主按钮：`#4A6FA5` 填充，白色文字，6px 圆角
- 次按钮：白色背景，`#4A6FA5` 1px 边框 + 文字
- 危险按钮：`#C46B6B` 填充
- 高度：32px（小）/ 36px（中）/ 40px（大）

**表格（Table）**
- 无外边框，行间底部分割线 `#F0F2F5`
- 斑马纹：隔行背景 `#FAFBFC`
- 表头：文字加粗，背景 `#F7F8FA`

**标签（Tag）**
- 4px 圆角，低饱和度底色 + 深色文字
- 角色：admin(蓝)、teacher(绿)、student(灰)
- 状态：已评(绿)、评分中(蓝)、失败(红)、草稿(灰)、已发布(绿)

**输入框（Input）**
- 1px `#DCDFE6` 边框，6px 圆角
- 聚焦：`#4A6FA5` 边框，浅蓝外发光
- 高度：36px

**统计卡片（Stat Card）**
- 大数字 28px + 单位标签 13px
- 底部 1px 分割线或图标装饰
- 可点击，hover 背景微变 `#F7F8FA`

### 5.6 评分报告专用组件

**ScoreCircle（总分圆形进度）**
- SVG 圆形进度条，直径 120px
- 背景环：`#E8ECF0`
- 进度环颜色：≥80 绿色、60-79 蓝色、40-59 黄色、<40 红色
- 中间显示分数（28px 加粗）+ 下方 "/100"

**DimensionBar（维度条形图）**
- 水平条，高度 24px，最大宽度 100%
- 颜色与分数对应（同上）
- 右侧显示：`分数 (×权重)`
- 下方展开区显示评语文本

**StatusTag（状态标签）**
- submitted → 灰色 "已提交"
- grading → 蓝色 + 旋转图标 "AI 评分中"
- graded → 绿色 "已评分"
- failed → 红色 "评分失败"

**MarkdownRenderer（Markdown 渲染）**
- 使用 `markdown-it` 或 `marked` 渲染 Markdown 文本
- 样式与系统整体风格一致：代码块浅灰背景 `#F7F8FA`，表格使用系统边框色
- 代码高亮：`highlight.js` 或 `Prism.js`（可选）
- 使用场景：评分报告综合评语（T5/S5）、知识问答回答（S6）、答题预览（S3）

**FileUploader（文件上传）**
- 拖拽区域：虚线边框 `#DCDFE6`，240px 高度，圆角 8px
- 拖拽 hover：边框变为 `#4A6FA5`，背景变为 `#F7F8FA`
- 已上传文件：显示文件名 + 文件大小 + 删除图标
- 支持格式：.pdf, .docx（前端校验）
- 文件大小限制：10MB
- 可与文本输入共存（文本 + 文件组合提交）

---

## 6. 数据流与状态管理

### 6.1 Pinia Store 设计

**authStore**
```
state:
  - token: string | null       // JWT token
  - user: UserResponse | null  // {id, username, role, real_name, ...}

actions:
  - login(username, password)  // POST /login → 存 token + user
  - fetchUser()                // GET /me → 更新 user
  - logout()                   // 清除 token + user + 跳转 /login

getters:
  - isLoggedIn: boolean
  - role: string
  - displayName: string        // real_name || username
```

**appStore**
```
state:
  - sidebarCollapsed: boolean  // 侧边栏是否折叠
  - globalLoading: boolean     // 全局加载状态
```

### 6.2 API 调用层

每个角色对应一个 API 文件，函数命名与后端端点一一对应：

```typescript
// api/student.ts
export const getStudentAssignments = () => api.get('/student/assignments')
export const getAssignmentDetail = (id: number) => api.get(`/student/assignments/${id}`)
export const submitAnswer = (id: number, content: string) => api.post(`/student/assignments/${id}/submit`, { content })
export const getStudentSubmissions = () => api.get('/student/submissions')
export const getStudentReport = (id: number) => api.get(`/student/reports/${id}`)
export const askQuestion = (question: string) => api.post('/student/qa', { question })
```

---

## 7. 非功能性需求

| 类别 | 要求 |
|------|------|
| 性能 | 首屏加载 < 2s；API 响应 < 500ms（不含 AI 评分）；AI 评分 < 60s |
| 兼容性 | Chrome 80+、Firefox 80+、Safari 14+、Edge 80+；iOS Safari、Android Chrome |
| 安全 | JWT token HTTPS 传输；密码 bcrypt 加密；前端不存储明文密码；API 权限隔离 |
| 可用性 | 无需安装，浏览器直接访问；操作步骤 ≤ 3 步完成核心任务 |
| 可维护性 | 前后端分离，API 契约驱动；组件化开发，共享组件复用率 > 60% |
| 国际化 | 当前仅支持中文；预留 i18n 结构（可后续扩展） |

---

## 8. 版本规划

### v1.0 — MVP（当前版本）

| 模块 | 包含功能 |
|------|---------|
| 认证 | 登录、退出、角色路由守卫 |
| 管理员 | Dashboard + 用户管理（CRUD + 批量导入）+ 系统配置 |
| 教师 | Dashboard + 知识库管理 + 作业管理（创建/编辑/发布）+ 提交列表 + 评分报告 |
| 学生 | Dashboard + 作业列表 + 答题页 + 我的提交（含轮询）+ 评分报告 + 知识问答 |

### v1.1 — 体验增强（规划中）

- 评分雷达图（ECharts）
- 作业分数分布直方图
- 批量导入支持 Excel 文件上传
- 答题富文本编辑器（支持公式、图片）
- 多轮对话式知识问答
- 移动端深度适配

### v2.0 — 扩展能力（远期）

- 多课程支持（不同课程独立知识库）
- 教师协同评改（AI 评分 + 教师修正）
- 学习分析看板（知识点掌握热力图）
- 题库管理 + 自动组卷
- 对外 API 开放（接入第三方教学平台）

---

## 9. API 接口参考（完整版）

> 本节提供所有 API 端点的完整请求/响应 JSON Schema，供前端设计时直接参考。
> 基础 URL：`/`（前端通过 Axios baseURL 配置）
> 认证方式：`Authorization: Bearer <token>`（除 `/login` 和 `/health` 外均需携带）

### 9.1 枚举值定义

前端需使用以下固定枚举值：

| 枚举 | 值 | 说明 |
|------|-----|------|
| **role** | `admin` | 管理员 |
| | `teacher` | 教师 |
| | `student` | 学生 |
| **submission.status** | `submitted` | 已提交（等待评分） |
| | `grading` | AI 评分中 |
| | `graded` | 已评分 |
| | `failed` | 评分失败 |
| **doc_type** | `specification` | 规范（默认） |
| | `textbook` | 教材 |
| | `other` | 其他 |
| **settings.category** | `llm` | LLM 配置 |
| | `embedding` | 向量模型配置 |
| | `reranker` | 重排序模型配置 |
| | `mineru` | PDF 解析配置 |
| | `general` | 通用配置 |

### 9.2 通用数据结构

以下 JSON 结构在多个接口中复用：

**UserResponse**（用户信息，多个接口返回此结构）

```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "real_name": "管理员",
  "student_id": null,
  "class_name": null,
  "created_at": "2026-04-18T10:00:00"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 用户 ID |
| username | string | 登录名 |
| role | string | admin / teacher / student |
| real_name | string\|null | 真实姓名 |
| student_id | string\|null | 学号（仅学生有值） |
| class_name | string\|null | 班级 |
| created_at | string\|null | ISO 8601 时间戳 |

**DimensionScoreItem**（维度评分，报告接口中复用）

```json
{
  "name": "accuracy",
  "label": "准确性",
  "score": 90,
  "weight": 0.3,
  "weighted_score": 27.0,
  "comment": "内容准确，技术要点表述正确"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 维度英文标识 |
| label | string | 维度中文标签（前端展示用） |
| score | int | 该维度原始分（0-100） |
| weight | float | 权重（0-1，所有维度权重之和 = 1） |
| weighted_score | float | 加权分 = score × weight |
| comment | string | AI 生成的该维度评语 |

**ReportResponse**（评分报告，教师和学生共享结构）

```json
{
  "id": 1,
  "submission_id": 1,
  "total_score": 85.5,
  "max_score": 100,
  "dimension_scores": [DimensionScoreItem, ...],
  "feedback": "整体表现良好，建议加强对规范的引用。",
  "references": ["JTG 1001-2017 3.2"],
  "regulations_found": ["JTG 1001-2017 第3.2条"],
  "regulations_cited": ["JTG 1001-2017"],
  "created_at": "2026-04-18T14:01:00"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 报告 ID |
| submission_id | int | 关联提交 ID |
| total_score | float | 加权总分 |
| max_score | int | 满分（固定 100） |
| dimension_scores | DimensionScoreItem[] | 各维度评分详情 |
| feedback | string | AI 综合评语 |
| references | string[] | 参考文献列表 |
| regulations_found | string[] | 检索到的相关规范 |
| regulations_cited | string[] | 学生已引用的规范 |
| created_at | string\|null | ISO 8601 时间戳 |

### 9.3 认证接口（无需角色）

#### POST /login — 登录

```json
// Request
{
  "username": "admin",
  "password": "admin123"
}

// Response 200
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}

// Response 401
{ "detail": "Invalid credentials" }
```

#### GET /me — 当前用户信息

```
Authorization: Bearer eyJ...

// Response 200 → UserResponse
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "real_name": "管理员",
  "student_id": null,
  "class_name": null,
  "created_at": "2026-04-18T10:00:00"
}
```

#### GET /health — 健康检查

```
// Response 200
{ "status": "ok" }
```

### 9.4 管理员接口（需 admin 角色）

#### POST /admin/users — 创建单个用户

```json
// Request
{
  "username": "teacher_zhang",
  "password": "pass123",
  "role": "teacher",
  "real_name": "张老师",
  "student_id": null,
  "class_name": null
}

// Response 200 → UserResponse
{
  "id": 5,
  "username": "teacher_zhang",
  "role": "teacher",
  "real_name": "张老师",
  "student_id": null,
  "class_name": null,
  "created_at": "2026-04-18T10:00:00"
}

// Response 400
{ "detail": "Username already exists" }
{ "detail": "Student ID already exists" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 唯一登录名 |
| password | string | 是 | 明文密码（后端 bcrypt 加密） |
| role | string | 否 | 默认 "student" |
| real_name | string\|null | 否 | 真实姓名 |
| student_id | string\|null | 否 | 学号（role=student 时建议填写） |
| class_name | string\|null | 否 | 班级 |

#### POST /admin/users/batch — 批量导入学生

```json
// Request
{
  "students": [
    {
      "username": "stu_001",
      "password": "123456",
      "real_name": "王同学",
      "student_id": "S001",
      "class_name": "隧道一班"
    },
    {
      "username": "stu_002",
      "password": "123456",
      "real_name": "李同学",
      "student_id": "S002",
      "class_name": "隧道一班"
    }
  ]
}

// Response 200
{
  "success_count": 2,
  "failed": [],
  "created_ids": [6, 7]
}

// Response 200（部分失败）
{
  "success_count": 1,
  "failed": [
    { "index": 1, "username": "stu_002", "reason": "student_id exists" }
  ],
  "created_ids": [6]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| success_count | int | 成功导入数量 |
| failed | Array<{index, username, reason}> | 失败列表 |
| created_ids | int[] | 成功创建的用户 ID 列表 |

#### GET /admin/users — 用户列表

```
// Query Params（均可选）
?role=student
&class_name=隧道一班

// Response 200 → UserResponse[]
[
  {
    "id": 4,
    "username": "student1",
    "role": "student",
    "real_name": "王同学",
    "student_id": "2024001",
    "class_name": "隧道一班",
    "created_at": "2026-04-18T10:00:00"
  }
]
```

**注意：** 当前版本无分页，返回全量数据。数据量大时前端应做客户端分页。

#### PUT /admin/users/{id} — 更新用户

```json
// Request（所有字段可选，仅传需要更新的字段）
{
  "real_name": "王大明",
  "class_name": "隧道二班",
  "password": "newpass123"
}

// Response 200 → UserResponse
{ "id": 4, "username": "student1", ... }
```

#### DELETE /admin/users/{id} — 删除用户

```
// Response 200
{ "status": "deleted" }

// Response 400
{ "detail": "Cannot delete yourself" }
```

#### GET /admin/stats — 系统统计

```json
// Response 200
{
  "total_users": 15,
  "total_documents": 5,
  "total_assignments": 3,
  "total_submissions": 30
}
```

#### GET /admin/settings — 获取所有配置

```json
// Response 200（按 category 分组）
{
  "llm": [
    { "id": 1, "key": "llm_model", "value": "deepseek-chat", "category": "llm", "updated_at": "2026-04-18T10:00:00" }
  ],
  "embedding": [
    { "id": 2, "key": "embedding_model", "value": "BAAI/bge-large-zh-v1.5", "category": "embedding", "updated_at": "2026-04-18T10:00:00" }
  ],
  "general": [
    { "id": 3, "key": "access_token_expire_minutes", "value": "60", "category": "general", "updated_at": "2026-04-18T10:00:00" }
  ]
}
```

#### PUT /admin/settings/{key} — 更新配置

```json
// Request
{ "value": "deepseek-v3" }

// Response 200
{ "id": 1, "key": "llm_model", "value": "deepseek-v3", "category": "llm", "updated_at": "2026-04-18T10:30:00" }
```

### 9.5 教师接口（需 teacher 或 admin 角色）

#### POST /teacher/knowledge — 上传文档

```
Content-Type: multipart/form-data

// Form Fields
title: "JTG 1001-2017 公路工程标准体系"    // string, 必填
doc_type: "specification"                     // string, 可选, 默认 "specification"
file: (PDF binary)                            // File, 必填, 仅接受 .pdf

// Response 200 → DocumentResponse
{
  "id": 1,
  "doc_uuid": "a1b2c3d4e5f6",
  "filename": "JTG 1001-2017.pdf",
  "title": "JTG 1001-2017 公路工程标准体系",
  "doc_type": "specification",
  "owner_id": 2,
  "chunk_count": 11,
  "uploaded_at": "2026-04-18T10:00:00"
}

// Response 400
{ "detail": "Only PDF files are supported" }

// Response 500
{ "detail": "Ingest failed: ..." }
```

#### GET /teacher/knowledge — 文档列表（仅自己的）

```json
// Response 200 → DocumentResponse[]
[
  {
    "id": 1,
    "doc_uuid": "a1b2c3d4e5f6",
    "filename": "JTG 1001-2017.pdf",
    "title": "JTG 1001-2017 公路工程标准体系",
    "doc_type": "specification",
    "owner_id": 2,
    "chunk_count": 11,
    "uploaded_at": "2026-04-18T10:00:00"
  }
]
```

#### DELETE /teacher/knowledge/{id} — 删除文档

```
// Response 200
{ "status": "deleted" }

// Response 404
{ "detail": "Document not found" }
```

删除时联动清除：数据库记录 + ChromaDB 向量数据 + 本地文件。

#### POST /teacher/assignments — 创建作业

```json
// Request
{
  "title": "公路工程标准体系概述",
  "description": "请阐述公路工程标准体系的总体框架结构",
  "question": "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。",
  "reference_answer": "标准体系分为六大板块...",
  "grading_criteria": {
    "dimensions": [
      { "name": "accuracy", "label": "准确性", "weight": 0.4, "description": "内容是否正确" },
      { "name": "completeness", "label": "完整性", "weight": 0.3, "description": "是否覆盖要点" },
      { "name": "innovation", "label": "创新性", "weight": 0.3, "description": "是否有独立思考" }
    ],
    "reference_answer": "标准体系分为六大板块...",
    "extra_instructions": "请重点关注对 JTG 系列规范的引用"
  },
  "deadline": "2026-05-01T23:59:59"
}

// Response 200 → AssignmentResponse
{
  "id": 1,
  "teacher_id": 2,
  "title": "公路工程标准体系概述",
  "description": "请阐述公路工程标准体系的总体框架结构",
  "question": "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。",
  "reference_answer": "标准体系分为六大板块...",
  "grading_criteria": "{\"dimensions\":[...],\"reference_answer\":\"...\",\"extra_instructions\":\"...\",\"max_score\":100}",
  "deadline": "2026-05-01T23:59:59",
  "is_published": false,
  "created_at": "2026-04-18T10:00:00"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 作业标题 |
| description | string | 是 | 题目描述（展示给学生） |
| question | string | 是 | 具体题目（传给 AI 评分） |
| reference_answer | string\|null | 否 | 参考答案 |
| grading_criteria | GradingCriteriaInput\|null | 否 | 不传则使用默认 4 维度 |
| deadline | datetime\|null | 否 | 截止时间 |

**GradingCriteriaInput 结构：**

```json
{
  "dimensions": [                        // 可选, 不传或为空则用默认维度
    {
      "name": "accuracy",                // 维度英文标识
      "label": "准确性",                  // 维度中文标签
      "weight": 0.4,                      // 权重，所有维度之和须 = 1.0
      "description": "内容是否正确"        // 评分描述（传给 AI）
    }
  ],
  "reference_answer": "...",             // 可选
  "extra_instructions": "..."            // 可选，额外评分指示
}
```

**默认 4 维度（不传 grading_criteria 时）：** 准确性(30%) + 完整性(25%) + 规范性(25%) + 创新性(20%)

#### GET /teacher/assignments — 作业列表

```json
// Response 200 → AssignmentSummary[]
[
  {
    "id": 1,
    "title": "公路工程标准体系概述",
    "is_published": true,
    "deadline": "2026-05-01T23:59:59",
    "created_at": "2026-04-18T10:00:00",
    "submission_count": 15
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| submission_count | int | 该作业下的提交数量（仅统计，不含分数） |

#### PUT /teacher/assignments/{id} — 编辑作业（仅草稿）

```json
// Request（所有字段可选）
{
  "title": "修改后的标题",
  "description": "修改后的描述",
  "question": "修改后的题目",
  "reference_answer": "修改后的参考答案",
  "grading_criteria": { ... },
  "deadline": "2026-05-15T23:59:59"
}

// Response 200 → AssignmentResponse（同创建响应）

// Response 400
{ "detail": "Cannot edit published assignment" }

// Response 404
{ "detail": "Assignment not found" }
```

#### PUT /teacher/assignments/{id}/publish — 发布作业

```
// Request: 无请求体

// Response 200 → AssignmentResponse（is_published 变为 true）

// Response 400
{ "detail": "Cannot edit published assignment" }
```

#### DELETE /teacher/assignments/{id} — 删除作业（仅草稿）

```
// Response 200
{ "status": "deleted" }

// Response 400
{ "detail": "Cannot delete published assignment" }
```

#### GET /teacher/assignments/{id}/submissions — 查看提交列表

```json
// Response 200 → SubmissionSummary[]
[
  {
    "id": 1,
    "assignment_id": 1,
    "student_name": "student1",
    "student_real_name": "王同学",
    "status": "graded",
    "submitted_at": "2026-04-18T14:00:00",
    "total_score": 85.5
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| student_name | string\|null | 学生登录名 |
| student_real_name | string\|null | 学生真实姓名（前端优先展示此字段） |
| total_score | float\|null | 评分总分，status 非 "graded" 时为 null |

**导航提示：** 教师需从提交列表跳转到评分报告页。当前后端 `SubmissionSummary` 不含 `report_id`。前端应通过以下方式获取 report_id：
- 当 `status == "graded"` 时，前端已知 submission_id（即 `id` 字段），可通过 `GET /teacher/reports/{report_id}` 查看报告
- 实际 report_id 需前端在跳转时调用 API 获取或通过列表页的上下文推断

#### GET /teacher/reports/{id} — 查看评分报告

```json
// Response 200 → ReportResponse
{
  "id": 1,
  "submission_id": 1,
  "total_score": 85.5,
  "max_score": 100,
  "dimension_scores": [
    { "name": "accuracy", "label": "准确性", "score": 90, "weight": 0.3, "weighted_score": 27.0, "comment": "内容准确，技术要点正确" },
    { "name": "completeness", "label": "完整性", "score": 85, "weight": 0.25, "weighted_score": 21.25, "comment": "覆盖了大部分要点" },
    { "name": "compliance", "label": "规范性", "score": 80, "weight": 0.25, "weighted_score": 20.0, "comment": "规范引用基本正确" },
    { "name": "innovation", "label": "创新性", "score": 85, "weight": 0.2, "weighted_score": 17.0, "comment": "有一定独立思考" }
  ],
  "feedback": "整体表现良好，建议加强对规范的引用。",
  "references": ["JTG 1001-2017 3.2"],
  "regulations_found": ["JTG 1001-2017 第3.2条 公路建设板块包含..."],
  "regulations_cited": ["JTG 1001-2017"],
  "created_at": "2026-04-18T14:01:00"
}
```

#### GET /teacher/assignments/{id}/export — 导出学生成绩

```
// Response 200 → CSV 文件下载
Content-Type: text/csv; charset=utf-8-sig
Content-Disposition: attachment; filename="作业标题_grades.csv"

// CSV 列结构（根据评分维度动态生成）
学号, 姓名, 班级, 提交状态, 总分, 准确性, 完整性, 规范性, 创新性, 评语, 提交时间
S001, 王同学, 隧道一班, graded, 85.5, 90, 85, 80, 85, 整体表现良好..., 2026-04-18 14:00:00

// Response 404
{ "detail": "Assignment not found" }
```

- CSV 包含 BOM 头（`\ufeff`），确保 Excel 正确识别中文
- 评分维度列名从作业的 `grading_criteria` 动态解析
- 未评分的提交行：总分和维度分留空，状态显示 submitted/grading/failed

### 9.6 学生接口（需 student 角色）

#### GET /student/assignments — 已发布作业列表

```json
// Response 200 → AssignmentForStudent[]
[
  {
    "id": 1,
    "title": "公路工程标准体系概述",
    "description": "请阐述公路工程标准体系的总体框架结构",
    "question": "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。",
    "deadline": "2026-05-01T23:59:59",
    "teacher_name": "张老师",
    "has_submitted": false
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| has_submitted | boolean | 当前学生是否已提交过（前端据此显示"答题"或"查看提交"按钮） |
| teacher_name | string\|null | 教师真实姓名（real_name），无则回退到 username |

#### GET /student/assignments/{id} — 作业详情（答题页）

```json
// Response 200 → AssignmentDetail
{
  "id": 1,
  "title": "公路工程标准体系概述",
  "description": "请阐述公路工程标准体系的总体框架结构",
  "question": "请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分。",
  "reference_answer": "标准体系分为六大板块...",
  "deadline": "2026-05-01T23:59:59",
  "teacher_name": "张老师"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| reference_answer | string\|null | 参考答案（教师创建时可选填写，答题页前端可选择性展示或隐藏） |

#### POST /student/assignments/{id}/submit — 提交答案

```
Content-Type: multipart/form-data

// 方式一：仅文本
content: "公路工程标准体系采用三层结构..."    // string, 手输 Markdown 文本

// 方式二：仅文件
file: (PDF/Word binary)                      // File, 支持 .pdf / .docx

// 方式三：文本 + 文件组合
content: "补充说明..."                        // string, 可选
file: (PDF/Word binary)                      // File, 可选

// 至少提供 content 或 file 其中一项

// Response 200
{ "id": 1, "status": "submitted" }

// Response 400
{ "detail": "Assignment deadline has passed" }
{ "detail": "Must provide text content or upload a file" }
{ "detail": "File must be .pdf or .docx" }
{ "detail": "Failed to parse file: ..." }

// Response 404
{ "detail": "Assignment not found" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 否* | Markdown 格式文本答案 |
| file | File | 否* | PDF 或 Word 文件（≤10MB） |

*\*content 和 file 至少提供一项。两者同时提供时，后端将文件解析文本追加到手输文本后面。*

后端行为：
- 文件上传后，解析 PDF/Word 为纯文本，存入 `submissions.content`
- 原始文件保存到服务器，记录在 `submissions.attachment_path`
- 自动触发后台评分（BackgroundTasks）

#### GET /student/submissions/{id}/attachment — 下载附件

```
// Response 200 → FileResponse (application/octet-stream)
// 直接下载原始上传文件

// Response 404
{ "detail": "Submission not found" }
{ "detail": "No attachment found" }
```

仅返回当前学生自己的提交附件。

#### GET /student/submissions — 我的提交列表

```json
// Response 200 → SubmissionSummary[]
[
  {
    "id": 1,
    "assignment_id": 1,
    "student_name": "student1",
    "student_real_name": "王同学",
    "status": "graded",
    "submitted_at": "2026-04-18T14:00:00",
    "total_score": 85.5,
    "has_attachment": true
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| has_attachment | boolean | 是否有附件文件，前端据此显示下载图标 |

**轮询机制：** 前端每 5 秒调用此接口，检查 status 是否从 `grading` 变为 `graded` 或 `failed`。超过 60 秒仍未完成则停止轮询并提示。

**导航到报告：** `status == "graded"` 时，前端需要跳转到报告页面。但当前 `SubmissionSummary` 不含 `report_id`。

> **前端解决方案：** 添加 `GET /student/reports/by-submission/{submission_id}` 接口（后端需补充），或前端在提交列表页通过已知 submission_id 查询关联的 report_id。当前 MVP 阶段可暂时使用 submission_id 作为导航参数，由后端在 report 路由中通过 submission_id 查找对应 report。

#### GET /student/reports/{id} — 查看评分报告

```json
// Response 200 → ReportResponse（结构同教师端，见 9.2 节）

// Response 403
{ "detail": "Not your report" }
```

#### POST /student/qa — 知识问答

```json
// Request
{ "question": "公路建设板块包含哪些模块？" }

// Response 200
{
  "answer": "公路建设板块包含勘测、设计、试验、检测、施工、监理、项目管理、造价共8个模块...",
  "sources": [
    {
      "index": 1,
      "text": "公路建设板块包含勘测、设计、试验、检测、施工、监理、项目管理、造价共8个模块...",
      "source_name": "JTG 1001-2017.pdf",
      "chunk_index": 3
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| answer | string | AI 生成的回答（Markdown 格式，前端使用 MarkdownRenderer 渲染） |
| sources | QASourceItem[] | 结构化引用来源列表 |

**QASourceItem 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| index | int | 引用序号 |
| text | string | 引用原文片段（截取前 500 字） |
| source_name | string\|null | 来源文档文件名（前端显示为标注） |
| chunk_index | int\|null | 文档内段落编号 |

**前端渲染建议：**
- AI 回答使用 MarkdownRenderer 渲染（支持加粗、列表、代码块等）
- 引用来源在回答下方以卡片形式展示
- 每条引用显示：`[来源: source_name · 段落 chunk_index]` + 原文折叠展开

### 9.7 分页说明

当前 MVP 版本所有列表接口（GET /admin/users, GET /teacher/knowledge, GET /teacher/assignments, GET /student/assignments, GET /student/submissions）**均无分页**，返回全量数据。

前端建议：
- 使用 Element Plus Table 的 `pagination` 组件做客户端分页
- 默认每页 20 条
- v1.1 版本计划添加后端分页支持

### 9.8 各页面 ↔ API 字段映射

#### A1 管理员 Dashboard

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 用户总数卡片 | GET /admin/stats | `total_users` |
| 文档总数卡片 | GET /admin/stats | `total_documents` |
| 作业总数卡片 | GET /admin/stats | `total_assignments` |
| 提交总数卡片 | GET /admin/stats | `total_submissions` |

#### A2 用户管理

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 角色筛选下拉 | GET /admin/users?role= | query param `role` |
| 班级筛选下拉 | GET /admin/users?class_name= | query param `class_name` |
| 用户表格-姓名列 | GET /admin/users | `real_name` |
| 用户表格-用户名列 | GET /admin/users | `username` |
| 用户表格-角色列 | GET /admin/users | `role` → 前端映射为中文标签 |
| 用户表格-学号列 | GET /admin/users | `student_id` |
| 用户表格-班级列 | GET /admin/users | `class_name` |
| 用户表格-创建时间列 | GET /admin/users | `created_at` → 格式化显示 |
| 新增用户表单 | POST /admin/users | request body |
| 批量导入结果 | POST /admin/users/batch | `success_count`, `failed[]` |
| 编辑用户弹窗 | PUT /admin/users/{id} | request body |
| 删除确认 | DELETE /admin/users/{id} | - |

#### A3 系统配置

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 分类 Tab（LLM/Embedding/...） | GET /admin/settings | 响应 JSON 的顶层 key 即分类名 |
| 配置项列表 | GET /admin/settings | 各分类下的数组 |
| 配置项 key | GET /admin/settings | `key` |
| 配置项 value（可编辑） | GET /admin/settings | `value` |
| 保存按钮 | PUT /admin/settings/{key} | request body `{value}` |

#### T1 教师教学概览

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 知识库文档数 | GET /teacher/knowledge | 数组 `.length` |
| 作业数（进行中/总数） | GET /teacher/assignments | 过滤 `is_published` 统计 |
| 待批改数 | GET /teacher/assignments | 遍历各作业的 `submission_count` |

#### T2 知识库管理

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 文档列表-标题 | GET /teacher/knowledge | `title` |
| 文档列表-类型 | GET /teacher/knowledge | `doc_type` → 前端映射中文 |
| 文档列表-分块数 | GET /teacher/knowledge | `chunk_count` |
| 文档列表-上传时间 | GET /teacher/knowledge | `uploaded_at` |
| 上传表单 | POST /teacher/knowledge | multipart: title, doc_type, file |
| 删除按钮 | DELETE /teacher/knowledge/{id} | - |

#### T3 作业管理

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 作业卡片-标题 | GET /teacher/assignments | `title` |
| 作业卡片-状态标签 | GET /teacher/assignments | `is_published` → "草稿"/"已发布" |
| 作业卡片-截止时间 | GET /teacher/assignments | `deadline` |
| 作业卡片-提交数 | GET /teacher/assignments | `submission_count` |
| 创建作业表单 | POST /teacher/assignments | request body |
| 编辑作业表单 | PUT /teacher/assignments/{id} | request body |
| 发布按钮 | PUT /teacher/assignments/{id}/publish | - |
| 删除按钮 | DELETE /teacher/assignments/{id} | - |

#### T4 提交列表

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 学生姓名列 | GET /teacher/assignments/{id}/submissions | `student_real_name` \|\| `student_name` |
| 状态标签列 | GET /teacher/assignments/{id}/submissions | `status` → StatusTag 组件 |
| 提交时间列 | GET /teacher/assignments/{id}/submissions | `submitted_at` |
| 分数列 | GET /teacher/assignments/{id}/submissions | `total_score`（仅 graded 时有值） |
| 点击行跳转报告 | 导航到 T5 页面，URL 使用 report_id | - |
| 导出成绩按钮 | GET /teacher/assignments/{id}/export | CSV 文件下载 |

#### T5 / S5 评分报告（教师端 / 学生端共享结构）

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| ScoreCircle 总分 | GET /teacher/reports/{id} 或 GET /student/reports/{id} | `total_score` / `max_score` |
| DimensionBar 维度条形图 | 同上 | `dimension_scores[].label`, `.score`, `.weight` |
| 维度评语（展开） | 同上 | `dimension_scores[].comment` |
| 综合评语卡片 | 同上 | `feedback` |
| 规范引用-已引用 | 同上 | `regulations_cited` |
| 规范引用-相关规范 | 同上 | `regulations_found` |
| 参考文献 | 同上 | `references` |

#### S1 学生学习概览

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 待完成作业数 | GET /student/assignments | 过滤 `has_submitted == false` 计数 |
| 已完成作业数 | GET /student/assignments | 过滤 `has_submitted == true` 计数 |
| 评分中数量 | GET /student/submissions | 过滤 `status == "grading"` 计数 |
| 最新评分分数 | GET /student/submissions | 最新一条 status=="graded" 的 `total_score` |

#### S2 作业列表

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 作业卡片-标题 | GET /student/assignments | `title` |
| 作业卡片-描述 | GET /student/assignments | `description` |
| 作业卡片-教师名 | GET /student/assignments | `teacher_name` |
| 作业卡片-截止时间 | GET /student/assignments | `deadline` |
| 作业卡片-提交状态 | GET /student/assignments | `has_submitted` → "去答题" / "查看提交" |

#### S3 答题页

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 题目标题 | GET /student/assignments/{id} | `title` |
| 题目描述 | GET /student/assignments/{id} | `description` |
| 具体题目 | GET /student/assignments/{id} | `question` |
| 参考答案（如展示） | GET /student/assignments/{id} | `reference_answer` |
| 截止时间 | GET /student/assignments/{id} | `deadline` |
| Markdown 编辑器 | POST /student/assignments/{id}/submit | `content` 字段 |
| Markdown 实时预览 | 前端 MarkdownRenderer | 编辑器内容实时渲染 |
| 文件上传区（拖拽） | POST /student/assignments/{id}/submit | `file` 字段（multipart） |
| 提交按钮 | POST /student/assignments/{id}/submit | content + file（至少一项） |

#### S4 我的提交

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 作业标题 | GET /student/submissions | `assignment_id` → 前端通过列表页缓存数据映射标题 |
| 提交时间 | GET /student/submissions | `submitted_at` |
| 状态标签 | GET /student/submissions | `status` → StatusTag 组件 |
| 分数 | GET /student/submissions | `total_score`（仅 graded 时有值） |
| 附件图标/下载 | GET /student/submissions | `has_attachment` → 有则显示下载图标 |
| 下载附件 | GET /student/submissions/{id}/attachment | FileResponse 下载 |
| 轮询刷新 | 每 5s 调用 GET /student/submissions | 检查 status 变化 |

#### S6 知识问答

| UI 元素 | API | 响应字段 |
|---------|-----|---------|
| 输入框 | POST /student/qa | `{question}` |
| AI 回答气泡 | POST /student/qa | `answer` → MarkdownRenderer 渲染 |
| 引用来源标注 | POST /student/qa | `sources[].source_name` · `sources[].chunk_index` |
| 引用原文（折叠展开） | POST /student/qa | `sources[].text` |

### 9.9 错误码汇总

| HTTP 状态码 | detail 值 | 触发场景 | 前端处理 |
|-------------|----------|---------|---------|
| 400 | Username already exists | 创建用户时用户名重复 | 表单下方提示 |
| 400 | Student ID already exists | 学号重复 | 表单下方提示 |
| 400 | Cannot delete yourself | 管理员删除自己 | ElMessage.error |
| 400 | Only PDF files are supported | 上传非 PDF（知识库） | ElMessage.warning |
| 400 | Cannot edit published assignment | 编辑已发布作业 | ElMessage.error |
| 400 | Cannot delete published assignment | 删除已发布作业 | ElMessage.error |
| 400 | Assignment deadline has passed | 超过截止时间提交 | 表单下方提示 |
| 400 | Must provide text content or upload a file | 提交时未提供文本和文件 | 表单下方提示 |
| 400 | File must be .pdf or .docx | 提交文件格式不符 | ElMessage.warning |
| 400 | Failed to parse file: ... | 文件解析失败 | ElMessage.error |
| 401 | Invalid credentials | 登录失败 | 登录页错误提示 |
| 401 | Not authenticated | Token 缺失/过期 | 清除 token，跳转登录页 |
| 403 | Not your assignment | 访问非自己作业的报告 | ElMessage.error |
| 403 | Not your report | 学生访问非自己提交的报告 | ElMessage.error |
| 404 | Document not found | 文档不存在/非本人 | 同 404 处理 |
| 404 | Assignment not found | 作业不存在 | 同 404 处理 |
| 404 | User not found | 用户 ID 不存在 | 同 404 处理 |
| 404 | Report not found | 报告不存在 | 同 404 处理 |
| 500 | Ingest failed: ... | PDF 入库处理失败 | ElMessage.error |
