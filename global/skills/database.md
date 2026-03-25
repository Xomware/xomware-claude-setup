---
name: database
description: >
  ALWAYS use when writing database queries, migrations, schemas, or data access
  patterns. Covers SQLite (aiosqlite), PostgreSQL, and raw SQL. Also triggers for:
  indexes, foreign keys, joins, N+1 queries, rollbacks, seed data, or data modeling.
  Never write a migration without this skill.
  Trigger phrases: "migration", "schema", "query", "SQL", "sqlite", "postgres",
  "index", "foreign key", "database", "aiosqlite", "asyncpg".
---

# Database Patterns — Xomware

## SQLite — aiosqlite (Python, default for personal apps)

```python
import aiosqlite

DB_PATH = "data/app.db"

async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db
```

### Schema via Migrations
```python
# migrations/001_create_users.sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

```python
# db.py — simple migration runner
import aiosqlite
from pathlib import Path

MIGRATIONS_DIR = Path("migrations")

async def run_migrations(db: aiosqlite.Connection) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    applied = {row[0] async for row in await db.execute("SELECT name FROM _migrations")}

    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        if migration.name not in applied:
            sql = migration.read_text()
            await db.executescript(sql)
            await db.execute("INSERT INTO _migrations (name) VALUES (?)", (migration.name,))
            await db.commit()
```

### Data Access Pattern
```python
# Always go through a module — never inline SQL in route handlers

async def list_users(db: aiosqlite.Connection, limit: int = 50) -> list[dict]:
    async with db.execute(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT ?", (limit,)
    ) as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

async def get_user(db: aiosqlite.Connection, user_id: int) -> dict | None:
    async with db.execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ) as cursor:
        row = await cursor.fetchone()
        return dict(row) if row else None

async def create_user(db: aiosqlite.Connection, email: str, name: str) -> dict:
    cursor = await db.execute(
        "INSERT INTO users (email, name) VALUES (?, ?) RETURNING *",
        (email, name),
    )
    row = await cursor.fetchone()
    await db.commit()
    return dict(row)
```

---

## PostgreSQL — asyncpg (Python, for larger services)

```python
import asyncpg

async def get_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
    )

async def list_users(pool: asyncpg.Pool, limit: int = 50) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT $1", limit
    )
    return [dict(row) for row in rows]

async def create_user(pool: asyncpg.Pool, email: str, name: str) -> dict:
    row = await pool.fetchrow(
        "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *",
        email, name,
    )
    return dict(row)
```

### Postgres Migrations (SQL files)
```sql
-- migrations/001_create_users.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
```

---

## TypeScript — Raw SQL (better-sqlite3 / postgres.js)

### SQLite (better-sqlite3)
```ts
import Database from "better-sqlite3";

const db = new Database("data/app.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function listUsers(limit = 50) {
  return db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT ?").all(limit);
}

export function createUser(email: string, name: string) {
  return db.prepare("INSERT INTO users (email, name) VALUES (?, ?) RETURNING *").get(email, name);
}
```

### PostgreSQL (postgres.js)
```ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

export async function listUsers(limit = 50) {
  return sql`SELECT * FROM users ORDER BY created_at DESC LIMIT ${limit}`;
}

export async function createUser(email: string, name: string) {
  const [user] = await sql`INSERT INTO users (email, name) VALUES (${email}, ${name}) RETURNING *`;
  return user;
}
```

---

## Safe Query Patterns

```python
# Python — always parameterized
# ❌ BAD
await db.execute(f"SELECT * FROM users WHERE id = {id}")

# ✅ GOOD (aiosqlite — ? placeholders)
await db.execute("SELECT * FROM users WHERE id = ?", (id,))

# ✅ GOOD (asyncpg — $N placeholders)
await pool.fetchrow("SELECT * FROM users WHERE id = $1", id)
```

```ts
// TypeScript — always parameterized
// ❌ BAD
db.prepare(`SELECT * FROM users WHERE id = ${id}`).get();

// ✅ GOOD (better-sqlite3)
db.prepare("SELECT * FROM users WHERE id = ?").get(id);

// ✅ GOOD (postgres.js — tagged template = safe)
await sql`SELECT * FROM users WHERE id = ${id}`;
```

---

## Migration Rules
- **Never edit an existing migration** — create a new one
- **Always test rollback** — write a matching `down` migration or test `DROP`
- Add indexes for every foreign key and common query filter
- `NOT NULL` by default — be explicit when nullable
- Use `ON DELETE CASCADE` or `SET NULL` — never leave dangling refs
- Migrations run in CI before deploy — never manually in prod
- SQLite: use `PRAGMA foreign_keys=ON` — it's off by default
- SQLite: use WAL mode for concurrent reads — `PRAGMA journal_mode=WAL`
