---
paths:
  - "**/*.py"
  - "**/lambdas/**"
  - "**/src/api/**"
  - "**/src/lib/**"
  - "**/src/services/**"
  - "**/app/api/**"
  - "**/requirements*.txt"
  - "**/pyproject.toml"
---

# Backend Rules

Non-negotiables. The `backend-standards` skill carries the full conventions;
`lambda-handler` carries the house shape for a Python Lambda endpoint, and
`database` carries data access.

- Secrets come from SSM or Secrets Manager. Never hardcoded, never a `.env` in prod.
- API responses use the `{ data, error, meta }` shape, consistently, everywhere.
- Validate at the boundary: pydantic v2 in Python, Zod in TypeScript.
- Explicit error handling. No silent catches, no `except Exception: pass`, structured
  error responses out of every handler.
- Type everything at the seams: type hints in Python, `strict: true` in TypeScript.
- New Lambda endpoints follow `lambdas/<name>/handler.py` with the `@handle_errors`
  decorator and the `lambdas/common` helpers. Don't hand-roll a new handler shape.
- Changing a response shape is a contract change — grep the callers before, not after.
- Run the project's test command after changes.
