---
name: docker-deploy
description: >
  ALWAYS use when working with Docker, container deployments, or cloud deploys.
  Also triggers for: Dockerfiles, multi-stage builds, reverse proxy config, SSL,
  health checks, container networking, VPS deploys, or AWS deployment patterns.
  Never write Docker or deployment config without this skill.
  Trigger phrases: "docker", "compose", "container", "dockerfile", "deploy",
  "reverse proxy", "SSL", "health check", "docker-compose.yml", "ecs", "s3 deploy".
---

# Docker & Deployment Patterns — Xomware

## Docker Compose Service

### Python/FastAPI App
```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: app-name
    restart: unless-stopped
    env_file: .env
    environment:
      - PORT=8000
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
      interval: 15s
      timeout: 5s
      retries: 5
```

### With Nginx Reverse Proxy
```yaml
services:
  app:
    build: .
    container_name: app-name
    restart: unless-stopped
    env_file: .env
    expose:
      - "8000"
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
      interval: 15s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      app:
        condition: service_healthy
```

### Nginx Config (VPS)
```nginx
server {
    listen 80;
    server_name app.xomware.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name app.xomware.com;

    ssl_certificate /etc/letsencrypt/live/app.xomware.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.xomware.com/privkey.pem;

    location / {
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Multi-Stage Dockerfiles

### Python
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Node.js/Next.js (3-Stage)
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### SPA Runtime Config Injection
```bash
#!/bin/sh
# docker-entrypoint.sh — inject env vars into static SPA at runtime
sed -i "s|</head>|<script>window.__CONFIG__={apiUrl:\"${API_URL}\"};</script></head>|" \
  /usr/share/nginx/html/index.html
exec nginx -g "daemon off;"
```

## Health Check Endpoint

### FastAPI
```python
@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Express/Node
```ts
app.get("/health", (req, res) => res.json({ status: "ok" }));
```

## AWS Deployment — S3 + CloudFront (Static Sites / SPAs)

### Deploy Script
```bash
#!/bin/bash
# scripts/deploy-s3.sh
set -euo pipefail

BUCKET="$1"
DISTRIBUTION_ID="$2"
BUILD_DIR="${3:-dist}"

# Sync build output to S3
aws s3 sync "$BUILD_DIR" "s3://$BUCKET" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# index.html — no cache (always fetch latest)
aws s3 cp "$BUILD_DIR/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/index.html"

echo "Deployed to s3://$BUCKET, invalidation sent."
```

### GitHub Actions Deploy
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run build
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - run: ./scripts/deploy-s3.sh ${{ vars.S3_BUCKET }} ${{ vars.CF_DISTRIBUTION_ID }}
```

## VPS Deployment

### Standard Deploy
```bash
# Pull latest, rebuild, restart
docker compose pull
docker compose build --no-cache
docker compose up -d --force-recreate
docker compose logs -f --tail=50
```

### SSL with Certbot (VPS)
```bash
# Initial setup
sudo certbot certonly --standalone -d app.xomware.com
# Auto-renew is handled by certbot timer/cron
```

## Environment Variables

```bash
# .env.example — commit this, not .env
DATABASE_URL=
ANTHROPIC_API_KEY=
PORT=8000
LOG_LEVEL=info

# For AWS deployments, use SSM Parameter Store or Secrets Manager
aws ssm get-parameter --name "/xomware/prod/api-key" --with-decryption --query "Parameter.Value" --output text
```

## Persistent Data

```yaml
services:
  app:
    volumes:
      - app-data:/app/data  # SQLite, uploads, etc.

volumes:
  app-data:
    driver: local
```

## Rules
- Always use `restart: unless-stopped` — not `always` (allows manual stops)
- Always add health checks — load balancers and orchestrators use them
- Use named volumes for persistent data — bind mounts are fragile
- Multi-stage builds for smaller images — don't ship build tools
- Use `.env.example` for templates, `.env` for actual values (gitignored)
- SSL via Let's Encrypt (Certbot) for VPS, ACM for AWS CloudFront
- Log with `docker compose logs -f --tail=50` after deploy to verify
- For static sites, use S3 + CloudFront — no containers needed
