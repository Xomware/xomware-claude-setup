---
name: python
description: >
  ALWAYS use when writing Python code — Lambda handlers, scripts, data processing, or AI
  tooling. Covers Xomware conventions for Python 3.12+: pydantic v2, boto3, DynamoDB,
  httpx, and pytest. For the shape of a Lambda endpoint specifically, load lambda-handler.
  Trigger phrases: "python", "pydantic", "lambda function", "boto3", "dynamodb", "httpx",
  "pip", "requirements.txt", "pytest", "async def", "ruff", "type hints".
---

# Python Patterns — Xomware

Xomware Python runs as AWS Lambda behind API Gateway, plus local scripts and tooling.
There is no FastAPI, Flask, or long-lived ASGI server anywhere in the stack — for the
endpoint pattern itself see the `lambda-handler` skill.

## Project Setup

Lambda backends pin exact versions in `requirements.txt` so the deployment bundle is
reproducible. Standalone tooling can use `pyproject.toml`.

```txt
# requirements.txt — Python 3.12
boto3==1.35.81
pydantic==2.8.0
PyJWT==2.9.0
httpx[http2]==0.27.2
```

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

```toml
# pyproject.toml — tooling config, present even when deps live in requirements.txt
[tool.ruff]
line-length = 100
target-version = "py312"
```

## Types — Always

```python
from __future__ import annotations

# Python 3.12+ — built-in generics, not the typing module
def process(items: list[str], limit: int = 10) -> dict[str, int]:
    ...
```

Type-hint anything crossing a boundary: the Lambda `event`, an API response, a DynamoDB
item. Those are the values that are actually untrusted.

## Pydantic v2

```python
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

class ShareCreate(BaseModel):
    track_id: str = Field(..., min_length=1)
    tags: list[str] = Field(default_factory=list)
    priority: int = Field(default=0, ge=0, le=5)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, v: list[str]) -> list[str]:
        return [t.lower().strip() for t in v]

class ShareResponse(ShareCreate):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}
```

Use `model_config`, not the inner `Config` class — that was v1.

## boto3 and DynamoDB

Create clients at module scope so they survive across warm invocations. Building one
inside the handler pays the connection cost on every request.

```python
import boto3
from boto3.dynamodb.conditions import Key

_dynamo = boto3.resource("dynamodb")
_table = _dynamo.Table(os.environ["SHARES_TABLE"])


def get_share(share_id: str) -> dict | None:
    resp = _table.get_item(Key={"shareId": share_id})
    return resp.get("Item")


def list_shares_for_user(email: str, limit: int = 25) -> list[dict]:
    resp = _table.query(
        IndexName="byOwner",
        KeyConditionExpression=Key("ownerEmail").eq(email),
        ScanIndexForward=False,
        Limit=limit,
    )
    return resp.get("Items", [])
```

- **Query, never scan.** A `scan` reads the whole table and gets slower as data grows.
  If a query needs an index that doesn't exist, add the GSI.
- **DynamoDB returns `Decimal` for numbers.** Convert at the boundary before serializing;
  `json.dumps` cannot handle `Decimal`.
- **Batch reads with `batch_get_item`**, capped at 100 keys per call, rather than looping
  `get_item`.
- **Paginate.** A `query` returns at most 1 MB; follow `LastEvaluatedKey` when the caller
  expects the full set.
- All table access lives in `lambdas/common/<entity>_dynamo.py`, never inline in a handler.

## Secrets and Config

```python
import boto3
from functools import lru_cache

_ssm = boto3.client("ssm")

@lru_cache(maxsize=None)
def get_parameter(name: str) -> str:
    """Resolved once per container, not per invocation."""
    resp = _ssm.get_parameter(Name=name, WithDecryption=True)
    return resp["Parameter"]["Value"]
```

Secrets come from SSM Parameter Store or Secrets Manager, cached at cold start. Plain
`os.environ` is fine for non-secret config like table names and log level.

## Error Handling

```python
class XomError(Exception):
    def __init__(self, message: str, code: str, handler: str = "unknown") -> None:
        super().__init__(message)
        self.code = code
        self.handler = handler
```

Each backend defines its own hierarchy in `lambdas/common/errors.py` and a
`@handle_errors` decorator that turns them into API Gateway responses. Raise the typed
error; never return an error dict from business logic.

## HTTP Clients

```python
import httpx

_client = httpx.Client(
    base_url="https://api.spotify.com/v1",
    timeout=httpx.Timeout(10.0),
    http2=True,
)

def fetch(endpoint: str, token: str) -> dict:
    resp = _client.get(endpoint, headers={"Authorization": f"Bearer {token}"})
    resp.raise_for_status()
    return resp.json()
```

- `httpx` over `requests`. Module-scope client for connection reuse across warm starts.
- **Always set an explicit timeout.** The default is no timeout, which in Lambda means
  hanging until the function times out and you pay for the full duration.
- Async (`httpx.AsyncClient`, `asyncio.gather`) is worth it when a handler fans out to
  several independent calls. A single sequential call does not need it.

## CLI Scripts

```python
#!/usr/bin/env python3
import typer

app = typer.Typer()

@app.command()
def main(
    input_file: str = typer.Argument(..., help="Input path"),
    dry_run: bool = typer.Option(False, "--dry-run"),
) -> None:
    ...

if __name__ == "__main__":
    app()
```

## Testing

```python
import pytest
from lambdas.shares_create.handler import handler

def api_event(body: dict, email: str = "dom@example.com") -> dict:
    return {
        "body": json.dumps(body),
        "requestContext": {"authorizer": {"email": email}},
    }

def test_rejects_missing_track_id():
    resp = handler(api_event({}), None)
    assert resp["statusCode"] == 400

@pytest.fixture
def stub_table(monkeypatch):
    """Mock the _dynamo module, not boto3 itself."""
    ...
```

pytest, no unittest. Mock at the `_dynamo` module boundary — mocking `boto3` directly
tests the AWS SDK rather than your code. Cover the happy path, each validation failure,
missing caller identity, and not-found.

## Rules

- Python 3.12+ — `match`/`case`, `tomllib`, `TaskGroup` are available
- `from __future__ import annotations` at the top of every module
- Pydantic v2 for data models — `model_config`, not the inner `Config` class
- `ruff` for lint and format — not black/flake8/pylint separately
- `pytest` for tests — not unittest
- `httpx` for HTTP, always with an explicit timeout — not `requests`
- boto3 clients and SSM lookups at module scope, so warm starts reuse them
- Convert `Decimal` to `int`/`float` before serializing DynamoDB items
- Absolute imports only — no relative `from ..module`
- No mutable default args — default to `None` and assign inside
- Never log a token, an auth header, or anything in the backend's `SENSITIVE_FIELDS`
