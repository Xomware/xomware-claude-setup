---
name: elixir
description: Use when writing Elixir modules, GenServers, supervisors, pipelines, or OTP applications. Core language patterns — see phoenix skill for web layer specifics.
---

# Elixir Patterns — Areté

## Module Structure
```elixir
defmodule MyApp.Feature.Context do
  @moduledoc """
  One-line summary of what this context does.
  """

  alias MyApp.Repo
  alias MyApp.Feature.Schema

  # Public API at top
  def get(id), do: Repo.get(Schema, id)
  def list(opts \\ []), do: ...

  # Private helpers below
  defp build_query(opts), do: ...
end
```

## Pattern Matching — Prefer Always
```elixir
# Function heads over if/case where possible
def process({:ok, result}), do: handle_result(result)
def process({:error, reason}), do: handle_error(reason)

# With for multi-step pipelines
def create_user(attrs) do
  with {:ok, validated} <- validate(attrs),
       {:ok, user} <- Repo.insert(validated),
       {:ok, _} <- send_welcome_email(user) do
    {:ok, user}
  end
end
```

## Error Handling
```elixir
# Always return tagged tuples from functions that can fail
@spec fetch_user(integer()) :: {:ok, User.t()} | {:error, :not_found}
def fetch_user(id) do
  case Repo.get(User, id) do
    nil -> {:error, :not_found}
    user -> {:ok, user}
  end
end

# Never raise for expected failures — raise only for programmer errors
```

## GenServer
```elixir
defmodule MyApp.Worker do
  use GenServer

  # Client API
  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  def do_work(payload), do: GenServer.call(__MODULE__, {:work, payload})

  # Server callbacks
  @impl true
  def init(opts), do: {:ok, %{opts: opts, count: 0}}

  @impl true
  def handle_call({:work, payload}, _from, state) do
    result = process(payload)
    {:reply, result, %{state | count: state.count + 1}}
  end

  @impl true
  def handle_info(:timeout, state), do: {:noreply, state}
end
```

## Supervisor
```elixir
defmodule MyApp.Application do
  use Application

  def start(_type, _args) do
    children = [
      MyApp.Repo,
      {MyApp.Worker, []},
      # Registry before processes that use it
      {Registry, keys: :unique, name: MyApp.Registry},
    ]

    Supervisor.start_link(children, strategy: :one_for_one)
  end
end
```

## Streams / Pipelines
```elixir
# Use Stream for lazy evaluation of large datasets
result =
  data
  |> Stream.filter(&valid?/1)
  |> Stream.map(&transform/1)
  |> Stream.chunk_every(100)
  |> Enum.each(&batch_insert/1)
```

## Rules
- Contexts over direct Repo calls in web layer
- Tagged tuples `{:ok, _}` / `{:error, _}` for all fallible functions
- `@spec` on all public functions
- `@moduledoc` on all modules
- `mix format` — no exceptions
- `credo` for style enforcement
- Test with `ExUnit` — test public interface, not internals
