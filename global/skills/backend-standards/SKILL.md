---
name: backend-standards
description: >
  ALWAYS use when doing any backend work — APIs, services, databases, auth,
  background jobs, CLI tools, or server-side logic. Covers backend conventions
  for Python and TypeScript. Load alongside language-specific skills.
  Trigger phrases: "api", "endpoint", "service", "backend", "auth", "middleware",
  "background job", "queue", "CLI tool", "server".
---

# Backend Standards

## Before Writing Code

1. Map blast radius -- what else does this touch?
2. Does an existing pattern or module already handle this?
3. Confirm secrets strategy -- check project CLAUDE.md or org rules for secrets approach
4. Read project CLAUDE.md for stack, auth provider, and org-specific conventions

## Secrets -- Non-Negotiable

- All secrets via a secrets manager (check org rules for which one). Never hardcoded.
- Never log secrets. Never pass as plaintext env vars.
- No `.env` files in production -- secrets injected at runtime.
- New services: provision secrets path before wiring the app.

## API Design

- RESTful by default. GraphQL only if explicitly justified.
- Versioned from day one: `/api/v1/`
- Response shape: `{ data, error, meta }` -- consistent everywhere
- Validate at the boundary: Pydantic (Python), Zod (TypeScript)
- All endpoints: auth check + input validation + error handling
- Error shape: `{ error: string, code: string, details?: any }`
- Never expose stack traces in responses
- Pagination on any list endpoint that could grow
- Return 404 with message, never empty 200

## Language Standards

**Python**
- `pyenv` + `.python-version` in every project
- Type hints on all functions -- no bare untyped `def`
- `ruff` for linting + formatting
- `structlog` or `aws-lambda-powertools` for logging -- never bare `print()`
- `pytest` with fixtures in `conftest.py`
- CLI tools: `typer` -- not argparse

**TypeScript/Node.js**
- `strict: true` in tsconfig -- no `any`
- `zod` for runtime validation of all external data
- Async/await -- no raw Promise chains
- Typed errors -- no silent catches

## Error Handling

- Explicit -- no silent failures, no bare `except:` / `catch {}`
- Structured error responses at API boundaries
- Log errors with context (request ID, user, operation)
- Retry with backoff for transient failures (network, rate limits)
- Circuit breaker for external service calls

## Self-Review

Before marking backend work done:
- [ ] Secrets: nothing hardcoded, managed via secrets manager
- [ ] Types: full coverage -- no `any` in TS, type hints in Python
- [ ] Error handling: all failure paths handled and logged
- [ ] Tests: happy path + at least one failure case
- [ ] No long-lived credentials in the diff
- [ ] Logging: structured, no secrets in output
- [ ] API shape: consistent `{ data, error, meta }`
- [ ] Migrations: reversible if applicable

## Common Mistakes

- Hardcoding secrets or AWS region (always use variable/config)
- Using `.env` in production containers
- Silent error swallowing in catch blocks
- Missing pagination on list endpoints
