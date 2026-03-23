---
name: env-config
description: Use when setting up environment variable management, config loading, or multi-environment configuration for any Areté service.
---

# Environment & Config Patterns — Areté

## The Rule
**Secrets live in Infisical. Config structure lives in code. Never in committed files.**

See `infisical` skill for secret fetch patterns.

---

## TypeScript / Node.js

```ts
// config.ts — single source of truth for all config
import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  // Optional with defaults
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  MAX_RETRIES: z.coerce.number().default(3),
});

// Fails at startup if invalid — never silently
export const config = ConfigSchema.parse(process.env);
export type Config = z.infer<typeof ConfigSchema>;
```

```ts
// Usage
import { config } from "./config";
const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
```

---

## Python

```python
# config.py — using pydantic-settings
from pydantic_settings import BaseSettings
from pydantic import field_validator

class Config(BaseSettings):
    env: str = "development"
    port: int = 8000
    database_url: str
    anthropic_api_key: str
    log_level: str = "info"

    @field_validator("env")
    @classmethod
    def validate_env(cls, v: str) -> str:
        if v not in ("development", "staging", "production"):
            raise ValueError(f"Invalid env: {v}")
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Singleton — import and use
config = Config()
```

---

## Elixir

```elixir
# config/runtime.exs — for runtime config (secrets, env-specific values)
import Config

config :my_app, MyApp.Repo,
  url: System.fetch_env!("DATABASE_URL"),
  pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10")

config :my_app,
  anthropic_api_key: System.fetch_env!("ANTHROPIC_API_KEY"),
  env: System.get_env("MIX_ENV", "dev")

# config/config.exs — static, non-secret config
config :my_app,
  ecto_repos: [MyApp.Repo],
  max_retries: 3
```

---

## Multi-Environment Pattern

```
.env.example     ← committed — shows all required vars, no values
.env.local       ← gitignored — local dev overrides
.env             ← gitignored — populated by: infisical export --env=dev
```

```bash
# .env.example — always keep updated
DATABASE_URL=
ANTHROPIC_API_KEY=
PORT=3000
LOG_LEVEL=info
```

```bash
# Makefile or package.json
dev:
  infisical run --env=dev -- npm run dev

prod:
  infisical run --env=prod -- node dist/server.js
```

---

## .gitignore Entries — Always Present
```gitignore
.env
.env.local
.env.*.local
*.pem
*.key
secrets/
```

## Rules
- `System.fetch_env!` / `z.string().min(1)` / pydantic required fields — **never optional for required secrets**
- Validate and parse all config at startup — fail fast, clear error messages
- `.env.example` is documentation — keep it current
- Different credentials per environment — dev secrets never work in prod
- Config is code-reviewed like code — treat changes to env structure seriously
