# CLAUDE.md — courseagent/frontend

React + TypeScript + Vite 前端项目，使用 pnpm 管理依赖。

## 启动

```bash
cd courseagent/frontend
pnpm dev
```

启动后访问 http://localhost:5173

## 构建

```bash
cd courseagent/frontend
pnpm build
```

## 关键结构

- `src/app/api/` — API 层（axios + Bearer token 拦截器）
  - `client.ts` — axios 实例，baseURL=http://localhost:8000
  - `auth.ts` — 登录 + 获取当前用户
  - `admin.ts` — 用户 CRUD + 统计 + 设置
  - `teacher.ts` — 文档 + 作业 + 提交 + 报告
  - `student.ts` — 作业 + 提交 + 报告 + QA
- `src/app/context/AuthContext.tsx` — 认证状态（JWT token + user）
- `src/app/pages/` — 按角色分目录：admin/ teacher/ student/
- `src/app/data/mockData.ts` — Mock 数据（已保留作为降级参考）

## 联调注意

- 后端必须先启动在 http://localhost:8000
- 测试账号：admin/admin123, teacher1/teacher123, student1/student123
- Token 存储在 localStorage: `tunnel_auth_token` + `tunnel_auth_user`
