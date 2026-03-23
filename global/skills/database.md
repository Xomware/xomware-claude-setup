---
name: database
description: Use when writing database queries, migrations, or data access patterns. Covers Postgres via Ecto (Elixir), Prisma (TypeScript), and raw SQL patterns.
---

# Database Patterns — Areté

## Elixir — Ecto

```elixir
# Schema
defmodule MyApp.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :email, :string
    field :name, :string
    field :role, Ecto.Enum, values: [:member, :admin], default: :member
    belongs_to :org, MyApp.Orgs.Org
    timestamps()
  end

  @required [:email, :name]
  @optional [:role]

  def changeset(user \\ %__MODULE__{}, attrs) do
    user
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_format(:email, ~r/@/)
    |> unique_constraint(:email)
    |> foreign_key_constraint(:org_id)
  end
end

# Context — all DB access goes through context functions
defmodule MyApp.Accounts do
  import Ecto.Query
  alias MyApp.{Repo, Accounts.User}

  def list_users(org_id) do
    User
    |> where([u], u.org_id == ^org_id)
    |> order_by([u], desc: u.inserted_at)
    |> Repo.all()
  end

  def get_user!(id), do: Repo.get!(User, id)

  def create_user(attrs) do
    %User{}
    |> User.changeset(attrs)
    |> Repo.insert()
  end
end
```

### Migrations
```elixir
defmodule MyApp.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users) do
      add :email, :string, null: false
      add :name, :string, null: false
      add :role, :string, null: false, default: "member"
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      timestamps()
    end

    create unique_index(:users, [:email])
    create index(:users, [:org_id])
  end
end
```

---

## TypeScript — Prisma

```prisma
// schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role     @default(MEMBER)
  orgId     String
  org       Org      @relation(fields: [orgId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId])
}

enum Role {
  MEMBER
  ADMIN
}
```

```ts
// Data access — always via a module, never inline Prisma calls
// src/lib/users.ts
import { prisma } from "./db";

export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { org: true },
  });
}

export async function listUsers(orgId: string) {
  return prisma.user.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(data: { email: string; name: string; orgId: string }) {
  return prisma.user.create({ data });
}
```

---

## Safe Query Patterns

```ts
// TypeScript — never string interpolation in queries
// ❌ BAD
const users = await prisma.$queryRaw(`SELECT * FROM users WHERE id = ${id}`);

// ✅ GOOD
const users = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;
// or just use the Prisma client methods
```

```elixir
# Elixir — parameterized queries via Ecto
# ❌ BAD
Repo.query("SELECT * FROM users WHERE id = #{id}")

# ✅ GOOD
Repo.get(User, id)
# or
from(u in User, where: u.id == ^id) |> Repo.one()
```

---

## Migration Rules
- **Never edit an existing migration** — create a new one
- **Always test rollback**: `mix ecto.rollback` / `prisma migrate reset`
- Add indexes for every foreign key and common query filter
- `null: false` by default — be explicit when nullable
- Use `on_delete: :delete_all` or `:nilify_all` — never leave dangling refs
- Migrations run in CI before deploy — never manually in prod
