---
name: python
description: Use when writing Python scripts, services, data processing, or AI tooling. Covers Areté conventions for Python 3.11+.
---

# Python Patterns — Areté

## Project Setup
```toml
# pyproject.toml (preferred over setup.py / requirements.txt)
[project]
name = "project-name"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "anthropic>=0.30",
    "pydantic>=2.0",
]

[tool.ruff]          # linter + formatter
line-length = 100
target-version = "py311"
```

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

## Types — Always
```python
# Use type hints everywhere. Python 3.11+ — use built-ins not typing module
def process(items: list[str], limit: int = 10) -> dict[str, int]:
    ...

# Pydantic for data validation / config
from pydantic import BaseModel, Field

class Config(BaseModel):
    api_key: str
    max_retries: int = Field(default=3, ge=1, le=10)
    debug: bool = False
```

## Async
```python
import asyncio
import httpx  # async HTTP — not requests

async def fetch(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()

# Parallel
results = await asyncio.gather(fetch(url1), fetch(url2))
```

## Error Handling
```python
# Custom exceptions — be specific
class AppError(Exception):
    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code

# Context managers for cleanup
from contextlib import asynccontextmanager

@asynccontextmanager
async def db_transaction(conn):
    async with conn.transaction():
        yield conn
```

## Environment / Config
```python
# Use pydantic-settings — validates and types env vars
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    anthropic_api_key: str
    database_url: str
    debug: bool = False

    class Config:
        env_file = ".env"

settings = Settings()  # fails fast if required vars missing
```

## CLI Scripts
```python
#!/usr/bin/env python3
# Use typer for CLI tools
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

## FastAPI

```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB, connections, etc.
    await init_db()
    yield
    # Shutdown: cleanup
    await close_db()

app = FastAPI(title="Service Name", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.aretecap.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Routers
```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/items", tags=["items"])

@router.get("/", response_model=list[ItemResponse])
async def list_items(
    limit: int = 10,
    offset: int = 0,
    db: Database = Depends(get_db),
) -> list[ItemResponse]:
    return await db.fetch_items(limit=limit, offset=offset)

@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    db: Database = Depends(get_db),
) -> ItemResponse:
    return await db.create_item(payload)
```

### Dependencies
```python
from fastapi import Depends, Header, HTTPException

async def verify_token(authorization: str = Header(...)) -> dict:
    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_jwt(token)
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

@router.get("/me")
async def get_me(user: dict = Depends(verify_token)) -> dict:
    return user
```

## Pydantic v2 Patterns

```python
from pydantic import BaseModel, Field, field_validator, model_validator

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    tags: list[str] = Field(default_factory=list)
    priority: int = Field(default=0, ge=0, le=5)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, v: list[str]) -> list[str]:
        return [t.lower().strip() for t in v]

class ItemResponse(ItemCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}  # replaces orm_mode
```

## Async SQLite (aiosqlite)

```python
import aiosqlite

DB_PATH = "data/app.db"

async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db

async def fetch_items(db: aiosqlite.Connection, limit: int = 10) -> list[dict]:
    async with db.execute(
        "SELECT * FROM items ORDER BY created_at DESC LIMIT ?", (limit,)
    ) as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
```

## httpx Async Client

```python
import httpx

# Reuse client across requests (connection pooling)
async def make_api_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url="https://graph.microsoft.com/v1.0",
        timeout=httpx.Timeout(30.0),
        headers={"Authorization": f"Bearer {token}"},
    )

async def fetch_data(client: httpx.AsyncClient, endpoint: str) -> dict:
    response = await client.get(endpoint)
    response.raise_for_status()
    return response.json()
```

## Testing (FastAPI)

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_list_items(client: AsyncClient):
    response = await client.get("/api/v1/items/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_create_item(client: AsyncClient):
    response = await client.post("/api/v1/items/", json={"name": "Test"})
    assert response.status_code == 201
    assert response.json()["name"] == "Test"
```

## Rules
- Python 3.11+ — use match/case, `tomllib`, `TaskGroup`
- Pydantic v2 for all data models — use `model_config` not inner `Config` class
- `ruff` for linting and formatting — no black/flake8/pylint separately
- `pytest` + `pytest-asyncio` for tests — no unittest
- `httpx` for async HTTP — not `requests`
- `aiosqlite` for async SQLite — always use WAL mode
- FastAPI with `lifespan` — not `on_event` decorators (deprecated)
- Absolute imports only — no relative `from ..module`
- No mutable default args: `def fn(items: list = None)` → `None` then assign
