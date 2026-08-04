---
name: env-config
description: >
  ALWAYS use when setting up environment variables, config loading, secrets injection,
  or multi-environment configuration. Also triggers for: .env files, config validation,
  runtime config, config schemas, or environment-specific behavior.
  Trigger phrases: "env", "environment variable", "config", ".env", "dotenv",
  "runtime config", "settings", "secrets", "ssm", "secrets manager".
---

# Environment & Config Patterns — Xomware

## The Rule
**Secrets live in AWS (SSM Parameter Store or Secrets Manager). Config structure lives in code. Never in committed files.**

---

## TypeScript / Node.js

```ts
// config.ts — single source of truth for all config
import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
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

## AWS Secrets — SSM Parameter Store

```bash
# Store a secret
aws ssm put-parameter \
  --name "/xomware/prod/anthropic-api-key" \
  --value "sk-ant-..." \
  --type SecureString

# Retrieve at deploy time or app startup
aws ssm get-parameter \
  --name "/xomware/prod/anthropic-api-key" \
  --with-decryption \
  --query "Parameter.Value" --output text
```

```python
# Python — fetch from SSM at startup
import boto3

def get_secret(name: str) -> str:
    ssm = boto3.client("ssm")
    response = ssm.get_parameter(Name=name, WithDecryption=True)
    return response["Parameter"]["Value"]
```

---

## Multi-Environment Pattern

```
.env.example     ← committed — shows all required vars, no values
.env.local       ← gitignored — local dev overrides
.env             ← gitignored — local dev values
```

```bash
# .env.example — always keep updated
DATABASE_URL=
ANTHROPIC_API_KEY=
PORT=3000
LOG_LEVEL=info
```

```bash
# Makefile
dev:
  source .env && python -m uvicorn app.main:app --reload

# Or use dotenv CLI
dev:
  dotenv run -- npm run dev
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
- `z.string().min(1)` / pydantic required fields — **never optional for required secrets**
- Validate and parse all config at startup — fail fast, clear error messages
- `.env.example` is documentation — keep it current
- Different credentials per environment — dev secrets never work in prod
- Config is code-reviewed like code — treat changes to env structure seriously
- Use AWS SSM Parameter Store for prod secrets — never commit them
