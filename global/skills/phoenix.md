---
name: phoenix
description: Use when building Phoenix controllers, LiveView, channels, plugs, or router config. Web layer specifics — see elixir skill for core OTP/module patterns.
---

# Phoenix Patterns — Areté

## Router Structure
```elixir
defmodule MyAppWeb.Router do
  use MyAppWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug MyAppWeb.Plugs.Auth  # custom auth plug
  end

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :protect_from_forgery
  end

  scope "/api", MyAppWeb.API do
    pipe_through :api
    resources "/users", UserController, only: [:index, :show, :create]
  end

  scope "/", MyAppWeb do
    pipe_through :browser
    live "/dashboard", DashboardLive, :index
  end
end
```

## Controllers — Thin
```elixir
defmodule MyAppWeb.API.UserController do
  use MyAppWeb, :controller

  alias MyApp.Accounts  # context — never Repo directly

  def create(conn, %{"user" => params}) do
    case Accounts.create_user(params) do
      {:ok, user} ->
        conn
        |> put_status(:created)
        |> render(:show, user: user)

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:errors, changeset: changeset)
    end
  end
end
```

## LiveView
```elixir
defmodule MyAppWeb.DashboardLive do
  use MyAppWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket), do: schedule_refresh()
    {:ok, assign(socket, data: load_data())}
  end

  @impl true
  def handle_info(:refresh, socket) do
    schedule_refresh()
    {:noreply, assign(socket, data: load_data())}
  end

  @impl true
  def handle_event("submit", %{"form" => params}, socket) do
    case process(params) do
      {:ok, result} ->
        {:noreply, assign(socket, result: result)}
      {:error, reason} ->
        {:noreply, put_flash(socket, :error, reason)}
    end
  end

  defp schedule_refresh, do: Process.send_after(self(), :refresh, 30_000)
end
```

## Plugs
```elixir
defmodule MyAppWeb.Plugs.Auth do
  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        case verify_token(token) do
          {:ok, claims} -> assign(conn, :current_user, claims)
          {:error, _} -> unauthorized(conn)
        end
      _ -> unauthorized(conn)
    end
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: "Unauthorized"})
    |> halt()
  end
end
```

## JSON Rendering — Use Jason Views
```elixir
defmodule MyAppWeb.UserJSON do
  def show(%{user: user}), do: %{data: data(user)}
  def index(%{users: users}), do: %{data: Enum.map(users, &data/1)}

  defp data(user), do: %{
    id: user.id,
    email: user.email,
    inserted_at: user.inserted_at,
  }
end
```

## Rules
- Controllers are thin — all logic in contexts
- No direct `Repo` calls in controllers or LiveViews
- All assigns documented with `attr` in LiveView components
- `halt()` after unauthorized responses in plugs
- Prefer LiveView over SPA for internal tools
- Use `Phoenix.PubSub` for real-time updates, not polling
