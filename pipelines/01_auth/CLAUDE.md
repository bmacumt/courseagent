# 01_auth — 认证授权 Pipeline

> 项目总文档：/home/binma/courseagent/CLAUDE.md

## 虚拟环境
路径：`.venv` | Python 3.12 | uv

## 运行
```
.venv/bin/python mvp_test.py
```

## 安装依赖
```
uv pip install fastapi pyjwt bcrypt sqlalchemy aiosqlite python-dotenv uvicorn httpx --python .venv/bin/python
```

## 模块状态
| 模块 | 状态 |
|------|------|
| config | ✅ |
| models | ✅ |
| database | ✅ |
| auth (密码+JWT) | ✅ |
| deps (权限校验) | ✅ |
| main (FastAPI端点) | ✅ |

## 项目文档索引
- 总文档：`/home/binma/courseagent/CLAUDE.md`
- 本 Pipeline 文档：`/home/binma/courseagent/docs/01_auth.md`
- 方案文档：`/home/binma/courseagent/方案.md`
