---
name: logging
description: Use when adding logging, structured logs, or observability to any Areté service. Covers structured logging patterns for TypeScript, Python, and Elixir.
---

# Logging & Observability — Areté

## Core Principle
**Structured logs over printf.** Every log entry should be parseable. Include context, not just messages.

---

## TypeScript — pino (preferred)

```ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Pretty print in dev, JSON in prod
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: {
    service: "arete-service-name",
    env: process.env.NODE_ENV,
  },
});

// Child logger for request context
const reqLogger = logger.child({ requestId: req.id, userId: req.user?.id });
reqLogger.info({ route: req.path }, "Request received");
reqLogger.error({ err, input }, "Failed to process request");
```

```ts
// Log levels — use correctly
logger.debug({ query }, "DB query executed");          // dev only, verbose
logger.info({ userId, action }, "User action taken");  // normal operations
logger.warn({ retries, url }, "Retrying failed call"); // unexpected but handled
logger.error({ err, context }, "Operation failed");    // errors that need attention
logger.fatal({ err }, "Unrecoverable error");          // about to crash
```

---

## Python — structlog

```python
import structlog

logger = structlog.get_logger()

# Configure once at startup
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if DEBUG else structlog.processors.JSONRenderer(),
    ]
)

# Usage
log = logger.bind(service="arete-service", user_id=user_id)
log.info("request_received", route=route, method=method)
log.error("operation_failed", error=str(err), context=context)

# Request-scoped context
structlog.contextvars.bind_contextvars(request_id=request_id, user_id=user_id)
```

---

## Elixir — Logger (built-in) + :telemetry

```elixir
# Built-in Logger
require Logger

Logger.info("User action", user_id: user_id, action: :login)
Logger.error("Operation failed", error: inspect(err), context: context)

# Structured metadata — set per-request
Logger.metadata(request_id: request_id, user_id: user_id)

# config/config.exs
config :logger,
  level: :info,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :user_id, :module]
```

---

## What to Always Log

| Event | Level | Required Fields |
|-------|-------|----------------|
| Request received | info | request_id, route, method, user_id |
| Request completed | info | request_id, status, duration_ms |
| External API call | debug | service, endpoint, duration_ms |
| External API failure | warn/error | service, status, error, retries |
| DB query slow (>200ms) | warn | query_name, duration_ms |
| Auth failure | warn | reason, ip, user_id (if known) |
| Background job started | info | job_type, job_id |
| Background job failed | error | job_type, job_id, error, attempt |
| Unhandled error | error | error, stack, context |

## What to Never Log
- Passwords, secrets, API keys (even partial)
- Full credit card numbers, SSNs, PII beyond IDs
- Full request bodies (may contain secrets)
- Tokens or session cookies

## Rules
- Always include `request_id` in web service logs — makes tracing possible
- Log at boundaries: API entry/exit, external calls, job start/end
- Errors need context: what was being attempted, what the input was, what failed
- `logger.error` for things ops needs to see; `logger.warn` for self-healing issues
- In tests, suppress logs or use a test logger — don't pollute test output
