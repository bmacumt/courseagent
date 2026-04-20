# 部署方案 — 隧道工程课程智能体平台

## 架构概览

```
用户浏览器
    │
    ▼
┌─────────────────────────────────┐
│  Nginx (反向代理 + 静态资源)     │  ← 443/80
│  /              → 前端 SPA       │
│  /api/*         → 后端 :8000     │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  FastAPI 后端 (:8000)           │
│  ├─ SQLite (./data/app.db)      │
│  ├─ ChromaDB (./data/chroma/)   │
│  ├─ 文件上传 (./data/uploads/)  │
│  └─ 外部 API (管理员界面配置):    │
│     DeepSeek / SiliconFlow /    │
│     MinerU 等（Key 存数据库）    │
└─────────────────────────────────┘
```

**推荐方案**：单台云服务器 + Docker Compose + Nginx。

理由：
- 项目规模（单课程、几十~几百学生）不需要 K8s 或微服务
- SQLite + 嵌入式 ChromaDB 足够应对，无需独立数据库服务
- Docker 化后迁移、备份、回滚都很方便

---

## 1. 服务器配置

### 推荐规格

| 项目 | 配置 | 说明 |
|------|------|------|
| CPU | 2 核 | LLM 调用是云端 API，本地不推理 |
| 内存 | 4 GB | ChromaDB + SQLite + FastAPI 足够 |
| 系统盘 | 40 GB SSD | OS + Docker + 代码 |
| 数据盘 | 按需挂载 | 存 uploads、DB、ChromaDB |
| 带宽 | 5 Mbps | 主要是文本交互，带宽需求低 |

### 云服务商选择

| 服务商 | 推荐产品 | 参考月费 |
|--------|----------|----------|
| 阿里云 | ECS 经济型 e实例 | ~60 元/月 |
| 腾讯云 | 轻量应用服务器 | ~50 元/月 |
| 华为云 | HECS 云耀服务器 | ~60 元/月 |

**建议**：选和 DeepSeek/SiliconFlow 同区域（国内华北/华东），降低 API 延迟。

### 域名

需要备案域名（国内服务器要求）。配置 DNS A 记录指向服务器 IP。

---

## 2. Docker 配置

### 项目结构

```
courseagent/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── .env                    # 生产环境变量（不提交 Git）
│   ├── app/
│   └── data/                   # 持久化数据（docker volume 映射）
├── frontend/
│   ├── Dockerfile
│   └── dist/                   # 构建产物
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  backend:
    build: ./backend
    container_name: courseagent-backend
    restart: always
    env_file: ./backend/.env
    volumes:
      - backend-data:/app/data
    ports:
      - "127.0.0.1:8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  frontend:
    build: ./frontend
    container_name: courseagent-frontend
    restart: always

  nginx:
    image: nginx:1.25-alpine
    container_name: courseagent-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro          # SSL 证书
      - frontend-dist:/usr/share/nginx/html:ro  # 前端静态文件
    depends_on:
      - backend
      - frontend

volumes:
  backend-data:
```

### backend/Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# 系统依赖（curl 用于 healthcheck，gcc 用于编译 bcrypt，ffmpeg 用于视频转写）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc curl ffmpeg && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY app/ ./app/

# 创建数据目录
RUN mkdir -p /app/data/uploads/submissions /app/data/chroma

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### frontend/Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# 构建时注入生产 API 地址
ENV VITE_API_BASE_URL=/
RUN pnpm build

FROM alpine:3.19
COPY --from=build /app/dist /dist
# 用空容器只为了在 compose 中构建，静态文件由 nginx 直接挂载
CMD ["cp", "-r", "/dist/.", "/shared/"]
```

### requirements.txt

在后端目录生成：

```bash
cd backend
.venv/bin/pip freeze > requirements.txt
```

---

## 3. Nginx 配置

### nginx/nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile    on;
    keepalive_timeout 65;
    client_max_body_size 50m;  # PDF 上传可能较大

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # HTTP → HTTPS 重定向
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$host$request_uri;
    }

    # HTTPS 主服务
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate     /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        # 前端静态文件
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;  # SPA 路由回退
        }

        # 后端 API 代理
        location /api/ {
            proxy_pass http://backend:8000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # SSE 流式响应（QA 问答）
            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 300s;
        }

        # 健康检查直通
        location /health {
            proxy_pass http://backend:8000/health;
        }
    }
}
```

**关键点**：
- `proxy_buffering off` — SSE 流式问答不能被 Nginx 缓冲
- `client_max_body_size 50m` — PDF 上传需要
- `try_files` — SPA 前端路由回退到 index.html
- `/api/` 前缀映射到后端根路径（去掉前缀）

---

## 4. 前端构建配置

### 修改 API 地址为相对路径

`frontend/src/app/api/client.ts` 修改 baseURL：

```typescript
const client = axios.create({
  baseURL: '/api',  // 相对路径，由 Nginx 代理到后端
  timeout: 30000,
});
```

### 后端 CORS 修改

`backend/app/main.py` CORS 配置改为允许同源：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
```

由于前后端走同一个 Nginx 域名，CORS 可以简化为同源，不需要跨域配置。

---

## 5. 环境变量

### 模型配置说明

**大模型、Embedding、Reranker、MinerU 的 API Key 均无需在 `.env` 中配置。** 这些信息在管理员界面（模型管理页面）中填入，保存到数据库。应用启动时 `sync_model_defaults_to_env()` 自动从数据库读取并同步到运行时环境变量。

部署后的配置流程：
1. 管理员登录 → 模型管理 → 添加提供商（填入 API Key、Base URL）
2. 配置各类型模型（chat/embedding/rerank）并设为默认
3. 点击"验证"确认连通性

### 生产环境 backend/.env

只需配置以下应用级变量：

```env
# ===== 必须修改 =====
SECRET_KEY=<随机 64 位字符串>          # openssl rand -hex 32 生成
ACCESS_TOKEN_EXPIRE_MINUTES=480       # 8 小时，课堂够用

# ===== 数据路径（容器内路径，不要改）=====
DATABASE_PATH=/app/data/app.db
CHROMA_PATH=/app/data/chroma
UPLOAD_DIR=/app/data/uploads
SUBMISSION_DIR=/app/data/uploads/submissions

# ===== 邮件（可选，用于邮箱修改验证码）=====
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=your-email@163.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_NAME=隧道工程课程智能体
```

---

## 6. SSL 证书

### 方案一：Let's Encrypt（免费，推荐）

```bash
# 安装 certbot
apt install certbot

# 获取证书（先停掉 80 端口）
certbot certonly --standalone -d your-domain.com

# 证书位置
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# 复制到项目目录
cp /etc/letsencrypt/live/your-domain.com/*.pem nginx/ssl/

# 自动续期（crontab）
0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/*.pem /path/to/courseagent/nginx/ssl/ && docker compose restart nginx
```

### 方案二：云服务商免费证书

阿里云/腾讯云/华为云控制台可申请免费 SSL 证书，下载 Nginx 格式放到 `nginx/ssl/`。

---

## 7. 部署步骤

### 首次部署

```bash
# 1. 登录服务器，拉取代码
git clone <your-repo> /opt/courseagent
cd /opt/courseagent

# 2. 生成 requirements.txt
cd backend
.venv/bin/pip freeze > requirements.txt   # 或本地生成后上传
cd ..

# 3. 配置环境变量
cp backend/.env.example backend/.env
vim backend/.env   # 填入生产配置

# 4. 修改前端 API 地址
# 编辑 frontend/src/app/api/client.ts → baseURL: '/api'

# 5. 准备 SSL 证书
mkdir -p nginx/ssl
# 放入 fullchain.pem 和 privkey.pem

# 6. 编辑 nginx.conf 中的域名
vim nginx/nginx.conf  # 替换 your-domain.com

# 7. 构建并启动
docker compose up -d --build

# 8. 查看日志确认启动
docker compose logs -f backend
```

### 更新部署

```bash
cd /opt/courseagent
git pull

# 重新构建并启动（旧容器会被替换）
docker compose up -d --build

# 数据在 docker volume 中，不会丢失
```

### 回滚

```bash
git log --oneline -5          # 找到上一个版本
git checkout <commit-hash>    # 切换到上一版本
docker compose up -d --build  # 重新构建
```

---

## 8. 数据备份

### 自动备份脚本

```bash
#!/bin/bash
# /opt/courseagent/backup.sh
# crontab: 0 2 * * * /opt/courseagent/backup.sh

BACKUP_DIR="/opt/backups/courseagent"
DATE=$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# 备份 SQLite 数据库
docker cp courseagent-backend:/app/data/app.db "$BACKUP_DIR/app.db.$DATE"

# 备份 ChromaDB
docker cp courseagent-backend:/app/data/chroma "$BACKUP_DIR/chroma.$DATE"

# 压缩
tar czf "$BACKUP_DIR/backup-$DATE.tar.gz" -C "$BACKUP_DIR" "app.db.$DATE" "chroma.$DATE"
rm -rf "$BACKUP_DIR/app.db.$DATE" "$BACKUP_DIR/chroma.$DATE"

# 保留最近 30 天
find $BACKUP_DIR -name "backup-*.tar.gz" -mtime +30 -delete

echo "[$DATE] Backup completed: backup-$DATE.tar.gz"
```

### 恢复

```bash
# 停止服务
docker compose stop backend

# 解压备份
tar xzf /opt/backups/courseagent/backup-20260420.tar.gz -C /tmp/

# 恢复数据
docker cp /tmp/app.db.20260420 courseagent-backend:/app/data/app.db
docker cp /tmp/chroma.20260420 courseagent-backend:/app/data/chroma

# 重启
docker compose start backend
```

---

## 9. 日常运维

### 日志查看

```bash
# 后端日志
docker compose logs -f backend --tail 100

# Nginx 日志
docker compose logs -f nginx --tail 100

# 所有服务状态
docker compose ps
```

### 监控

在管理后台（http://your-domain.com/admin/models）可查看：
- 模型配置状态
- 系统统计（用户数、作业数、提交数）

### 安全注意事项

| 项目 | 措施 |
|------|------|
| SECRET_KEY | 生产环境必须换随机值 |
| 数据库密码 | 当前 SQLite 无密码，靠文件系统权限保护 |
| 模型 API Key | 存储在数据库中，通过管理员界面管理，不暴露在配置文件里 |
| 服务器防火墙 | 只开放 22/80/443 端口 |
| SSH 登录 | 禁用密码登录，仅用密钥 |
| 文件上传 | Nginx 限制 `client_max_body_size`，后端校验文件类型 |

---

## 10. 常见问题

### Q: 首次评分很慢？
A: 首次启动时 `sync_model_defaults_to_env` 从 DB 读取模型配置。确认管理后台已正确配置 API Key 并验证通过。

### Q: SSE 流式问答被截断？
A: 检查 Nginx 的 `proxy_buffering off` 和 `proxy_read_timeout` 配置。

### Q: 上传 PDF 失败？
A: 检查 `client_max_body_size`（Nginx）和后端 `UPLOAD_DIR` 权限。

### Q: ChromaDB 占用内存大？
A: ChromaDB 会缓存向量索引。4GB 内存的服务器上，如果知识库文档多（>100 份），考虑升级到 8GB。

### Q: 需要多实例负载均衡吗？
A: 单课程场景（<200 学生并发）不需要。SQLite 写锁在并发写入时可能成为瓶颈，但学生提交作业不是高频操作。

---

## 备选方案对比

| 方案 | 适用场景 | 成本 | 复杂度 |
|------|----------|------|--------|
| **Docker Compose（推荐）** | 单课程、<500 学生 | ~60 元/月 | 低 |
| 宝塔面板部署 | 不熟悉 Docker 的运维人员 | ~60 元/月 | 中 |
| K8s / 云原生 | 多课程、大规模 | 300+ 元/月 | 高 |

如果后续需要扩展为多课程平台，优先考虑：
1. SQLite → PostgreSQL
2. 文件上传 → 对象存储（OSS/S3）
3. 单机 → K8s 弹性伸缩
