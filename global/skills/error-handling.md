---
name: error-handling
description: >
  ALWAYS use when designing error handling, result types, or error propagation. Covers
  typed errors, Result patterns, and error boundaries across TypeScript and Python.
  Also triggers for: custom error classes, error codes, HTTP error responses.
  Trigger phrases: "error handling", "result type", "AppError", "try/catch",
  "error propagation", "typed errors", "error boundary".
---

# Error Handling Patterns — Xomware

## Core Principle
**Errors are data, not exceptions.** Expected failures (not found, invalid input, rate limited) should be returned as values. Exceptions should be reserved for truly unexpected states.

---

## TypeScript

```ts
// Typed error hierarchy
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, "NOT_FOUND", 404, { resource, id });
  }
}

class ValidationError extends AppError {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message, "VALIDATION_ERROR", 400, { fields });
  }
}

// Result type for functions that can fail predictably
type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

async function findUser(id: string): Promise<Result<User>> {
  const user = await db.users.findById(id);
  if (!user) return { ok: false, error: new NotFoundError("User", id) };
  return { ok: true, data: user };
}

// Usage
const result = await findUser(id);
if (!result.ok) return res.status(result.error.statusCode).json({ error: result.error.code });
const { data: user } = result;
```

---

## Python

```python
# Typed exception hierarchy
class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code

class NotFoundError(AppError):
    def __init__(self, resource: str, id: str) -> None:
        super().__init__(f"{resource} {id} not found", "NOT_FOUND", 404)
        self.resource = resource
        self.id = id

class ValidationError(AppError):
    def __init__(self, message: str, fields: dict | None = None) -> None:
        super().__init__(message, "VALIDATION_ERROR", 400)
        self.fields = fields or {}

# Result type (Python 3.11+)
from typing import TypeVar, Generic
T = TypeVar("T")

class Ok(Generic[T]):
    def __init__(self, value: T) -> None:
        self.value = value
    def is_ok(self) -> bool: return True

class Err(Generic[T]):
    def __init__(self, error: T) -> None:
        self.error = error
    def is_ok(self) -> bool: return False

Result = Ok[T] | Err[AppError]
```

---

## API Error Responses — Consistent Shape

All APIs return errors in this shape:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User 123 not found",
    "details": {}
  }
}
```

HTTP status codes:
| Code | Meaning |
|------|---------|
| 400 | Validation / bad input |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Dependency unavailable |

## Rules
- Expected failures → return as values, not exceptions
- Unexpected failures → let them propagate, catch at boundary
- Always log with context: `logger.error("Failed to create user", { userId, error })`
- Never swallow errors silently — at minimum log them
- Distinguish user errors (4xx) from system errors (5xx) in logs and alerts
