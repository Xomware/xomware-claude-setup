---
name: docker-deploy
description: Use when deploying applications with Docker Compose and Traefik. Covers container setup, reverse proxy, SSL, health checks, and deployment patterns for Python, Elixir, and Node.js apps.
---

# Docker Compose + Traefik Deployment — Areté Patterns

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
    expose:
      - "8000"
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
      interval: 15s
      timeout: 5s
      retries: 5
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`app.example.com`)"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.routers.app.tls=true"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
      - "traefik.http.routers.app.middlewares=security-headers@file,rate-limit@file"
      - "traefik.http.services.app.loadbalancer.server.port=8000"
      - "traefik.docker.network=aichat_openwebui-network"
    networks:
      - web

networks:
  web:
    external: true
    name: aichat_openwebui-network  # shared across all Areté services
```

### Elixir/Phoenix App
```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        MIX_ENV: prod
    container_name: phoenix-app
    restart: unless-stopped
    env_file: .env
    environment:
      - PHX_HOST=app.example.com
      - PORT=4000
      - SECRET_KEY_BASE=${SECRET_KEY_BASE}
      - DATABASE_URL=${DATABASE_URL}
    expose:
      - "4000"
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:${PORT:-4000}/healthz || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.phoenix.rule=Host(`app.example.com`)"
      - "traefik.http.routers.phoenix.entrypoints=websecure"
      - "traefik.http.routers.phoenix.tls=true"
      - "traefik.http.routers.phoenix.tls.certresolver=letsencrypt"
      - "traefik.http.routers.phoenix.middlewares=security-headers@file,rate-limit@file"
      - "traefik.http.services.phoenix.loadbalancer.server.port=4000"
      - "traefik.docker.network=aichat_openwebui-network"
    networks:
      - web
```

## Traefik Reverse Proxy

### Traefik Static Config (traefik.yml)
```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@example.com
      storage: /etc/traefik/acme/acme.json
      httpChallenge:
        entryPoint: web

api:
  dashboard: true

accessLog:
  format: json
```

### Traefik Dynamic Config (dynamic.yml) — Middleware
```yaml
http:
  middlewares:
    security-headers:
      headers:
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        frameDeny: true
        contentTypeNosniff: true
        browserXssFilter: true
        referrerPolicy: "strict-origin-when-cross-origin"
    rate-limit:
      rateLimit:
        average: 1000
        burst: 500
        period: "1s"
    https-redirect:
      redirectScheme:
        scheme: https
        permanent: true
```

### Traefik Service (docker-compose)
```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./traefik.yml:/etc/traefik/traefik.yml:ro"
      - "./dynamic.yml:/etc/traefik/dynamic.yml:ro"
      - "traefik_certs:/etc/traefik/acme"
    networks:
      - web

volumes:
  traefik_certs:

networks:
  web:
    name: aichat_openwebui-network
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

### Elixir/Phoenix
```dockerfile
FROM elixir:1.17-slim AS builder
ENV MIX_ENV=prod
WORKDIR /app
RUN mix local.hex --force && mix local.rebar --force
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod && mix deps.compile
COPY . .
RUN mix assets.deploy && mix release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 libncurses6 curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/_build/prod/rel/app_name ./
EXPOSE 4000
CMD ["bin/app_name", "start"]
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
sed -i "s|</head>|<script>window.__CONFIG__={apiUrl:\"${API_URL}\",clientId:\"${CLIENT_ID}\"};</script></head>|" \
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

### Phoenix
```elixir
# In router.ex
get "/health", HealthController, :index

# In health_controller.ex
def index(conn, _params) do
  json(conn, %{status: "ok"})
end
```

## Deployment Commands

### Standard Deploy
```bash
# Pull latest, rebuild, restart with zero downtime
docker compose pull
docker compose build --no-cache
docker compose up -d --force-recreate
docker compose logs -f --tail=50
```

### Blue/Green Deploy (arilearn-phx pattern)

Two app services (`app_blue`, `app_green`) in the same docker-compose.yml. One stable Traefik router targets the active color via `ACTIVE_COLOR` env var.

```yaml
# Both colors get the SAME stable router label — critical!
# This prevents the router from disappearing when old color stops
services:
  app_blue:
    labels:
      - "traefik.http.routers.app.rule=Host(`app.example.com`)"
      - "traefik.http.routers.app.service=app-${ACTIVE_COLOR:-blue}"
      - "traefik.http.services.app-blue.loadbalancer.server.port=4000"
  app_green:
    labels:
      - "traefik.http.routers.app.rule=Host(`app.example.com`)"
      - "traefik.http.routers.app.service=app-${ACTIVE_COLOR:-blue}"
      - "traefik.http.services.app-green.loadbalancer.server.port=4000"
```

Deployment flow:
```bash
# scripts/blue_green_deploy.sh
# 1. Detect current active color (from state file or labels)
# 2. Build image
# 3. Run migrations (pre-cutover, expand-only)
# 4. Start inactive color
# 5. Health gate: internal check via Docker network
# 6. Switch ACTIVE_COLOR → recreate to update Traefik labels
# 7. Health gate: public HTTPS check
# 8. Stop old color (optional: KEEP_OLD_COLOR=1 to keep it running)
```

**Critical gotcha**: Stable router labels must exist on BOTH colors. If you anchor the router to only one color, it disappears when that color is stopped.

### Rollback
```bash
./scripts/blue_green_deploy.sh rollback [color]
# Flips traffic back, validates health before and after
# State persisted in .deploy/blue_green_state.env
```

### Migration Safety (Expand/Contract for Blue/Green)
During blue/green, old and new app versions run simultaneously:
- **Expand**: Add columns, new tables, additive indexes (backward compatible)
- **Deploy**: Code reads/writes both old and new schema
- **Contract**: Remove old columns in a later release (after old code is gone)
- **Never**: Drop columns still used by old code, rename without shim

## Environment Variables

```bash
# .env.example — commit this, not .env
DATABASE_URL=
SECRET_KEY_BASE=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
ANTHROPIC_API_KEY=

# Use Infisical for secrets management
infisical run --env=prod -- docker compose up -d
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
- Always add health checks — Traefik uses them for routing decisions
- Never expose ports directly — let Traefik handle external traffic
- Use named volumes for persistent data — bind mounts are fragile
- Multi-stage builds for smaller images — don't ship build tools
- Use `.env.example` for templates, `.env` for actual values (gitignored)
- External `web` network shared across all services behind Traefik
- SSL via Let's Encrypt HTTP challenge — requires port 80 open
- Log with `docker compose logs -f --tail=50` after deploy to verify
