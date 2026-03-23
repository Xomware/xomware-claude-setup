---
name: testing
description: Use when writing tests across any Areté language. Covers patterns for TypeScript/Jest, Python/pytest, and Elixir/ExUnit.
---

# Testing Patterns — Areté

## Philosophy
- Test behavior, not implementation — test what it does, not how
- One assertion per test concept (not per `expect` call)
- Tests should read like specs: "given X, when Y, then Z"
- Failing tests must have clear error messages

---

## TypeScript — Jest / Vitest

```ts
// Naming: describe the behavior
describe("createUser", () => {
  it("returns the new user when given valid input", async () => {
    const user = await createUser({ email: "test@example.com", name: "Test" });
    expect(user.id).toBeDefined();
    expect(user.email).toBe("test@example.com");
  });

  it("throws AppError when email is already taken", async () => {
    await createUser({ email: "dupe@example.com", name: "First" });
    await expect(
      createUser({ email: "dupe@example.com", name: "Second" })
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });
});

// Mocking — mock at the boundary, not internals
jest.mock("../lib/db", () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
}));

// Fixtures
const buildUser = (overrides = {}) => ({
  id: "user-123",
  email: "test@example.com",
  role: "member",
  ...overrides,
});
```

### Anthropic API Mocking
```ts
jest.mock("@anthropic-ai/sdk", () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: "mocked response" }],
      }),
    },
  })),
}));
```

---

## Python — pytest

```python
# conftest.py — shared fixtures
import pytest

@pytest.fixture
def mock_db(mocker):
    return mocker.patch("myapp.db.query", return_value=[{"id": 1}])

@pytest.fixture
def user():
    return {"id": "user-123", "email": "test@example.com"}

# Test file
class TestCreateUser:
    async def test_returns_user_on_valid_input(self, mock_db):
        result = await create_user({"email": "test@example.com"})
        assert result["id"] is not None

    async def test_raises_on_duplicate_email(self, mock_db):
        mock_db.side_effect = DuplicateKeyError("email")
        with pytest.raises(AppError, match="EMAIL_TAKEN"):
            await create_user({"email": "dupe@example.com"})

# Run: pytest -x -v --tb=short
```

### Anthropic API Mocking (Python)
```python
@pytest.fixture
def mock_anthropic(mocker):
    mock = mocker.patch("anthropic.Anthropic")
    mock.return_value.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text="mocked")]
    )
    return mock
```

---

## Elixir — ExUnit

```elixir
defmodule MyApp.AccountsTest do
  use MyApp.DataCase, async: true  # async: true when no shared state

  alias MyApp.Accounts

  describe "create_user/1" do
    test "returns {:ok, user} with valid attrs" do
      assert {:ok, user} = Accounts.create_user(%{email: "test@example.com"})
      assert user.email == "test@example.com"
    end

    test "returns {:error, changeset} with invalid email" do
      assert {:error, changeset} = Accounts.create_user(%{email: "bad"})
      assert "is invalid" in errors_on(changeset).email
    end
  end
end

# Factories with ex_machina
defmodule MyApp.Factory do
  use ExMachina.Ecto, repo: MyApp.Repo

  def user_factory do
    %MyApp.Accounts.User{
      email: sequence(:email, &"user#{&1}@example.com"),
      name: "Test User",
    }
  end
end

# Usage
user = insert(:user)
user = insert(:user, email: "custom@example.com")
```

---

## Rules — All Languages
- Tests live next to code: `module.test.ts`, `test_module.py`, `module_test.exs`
- No test depends on another test's state — each test is isolated
- Mock at the boundary (network, DB, external APIs) — not internals
- Test the public interface — if you're testing private functions, refactor instead
- CI must pass before merge — no "I'll fix tests later"
- Use `async: true` (Elixir) / parallel test runners where safe
