---
name: error-handling
description: Use when designing error handling for any service, API, or module. Covers typed errors, result patterns, and error propagation across TypeScript, Python, and Elixir.
---

# Error Handling Patterns — Areté

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

## Elixir

```elixir
# Tagged tuples — the Elixir way
defmodule MyApp.Error do
  @type t :: %__MODULE__{
    code: atom(),
    message: String.t(),
    context: map()
  }

  defstruct [:code, :message, context: %{}]

  def not_found(resource, id),
    do: %__MODULE__{code: :not_found, message: "#{resource} #{id} not found",
                    context: %{resource: resource, id: id}}

  def validation(message, fields \\ %{}),
    do: %__MODULE__{code: :validation_error, message: message,
                    context: %{fields: fields}}
end

# Usage in functions
def get_user(id) do
  case Repo.get(User, id) do
    nil -> {:error, Error.not_found("User", id)}
    user -> {:ok, user}
  end
end

# Propagation with `with`
def process(user_id, attrs) do
  with {:ok, user} <- get_user(user_id),
       {:ok, validated} <- validate(attrs),
       {:ok, updated} <- update(user, validated) do
    {:ok, updated}
  end
  # Any {:error, _} short-circuits and bubbles up
end
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
