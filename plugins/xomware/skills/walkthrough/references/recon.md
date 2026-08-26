# Recon recipes

Per-stack instructions for finding where execution actually begins. Pass the matching
section to the recon agent.

Identify the stack from manifests first: `package.json`, `angular.json`, `pyproject.toml`,
`requirements.txt`, `Package.swift`, `*.tf`, `template.yaml`.

---

## Python / AWS Lambda

```bash
fd -t f "handler.py" lambdas/                              # one dir per endpoint
rg -n "@handle_errors|def lambda_handler|def handler" lambdas/
rg -n "resource\(\"dynamodb\"\)|Table\(" lambdas/common/ -l   # data access modules
rg -n "requestContext|authorizer" lambdas/ -l              # who is authenticated where
```

`lambdas/<name>/handler.py` is the unit — each is an endpoint, so the directory listing
is the API surface and the best possible stop 1. Then `lambdas/common/` for the shared
helpers every handler leans on. For the cron Lambdas, check the EventBridge rules in
Terraform rather than the code — the schedule is not in the handler.

## Angular

```bash
rg -n "bootstrapApplication|provideRouter" src/main.ts src/app/       # boot + route table
fd -e ts "\.routes\.ts$" src/                                        # lazy-loaded features
rg -n "@Component|@Injectable" src/app/ -l | head
rg -n "inject\(|signal\(|computed\(" src/app/ -l | head             # state, the modern way
```

`main.ts` plus the root route table is stop 1 — it's the literal boot order and the map of
every lazy-loaded feature. Services marked `providedIn: "root"` are the long-lived state;
find those before reading any component.

## Swift / SwiftUI

```bash
rg -n "@main" Sources/ */                                  # app entry point
rg -n "@Observable|@State|@Environment" --glob "*.swift" -l
rg -n "NavigationStack|TabView" --glob "*.swift" -l        # the navigation shape
rg -n "@Model|ModelContainer" --glob "*.swift" -l          # SwiftData persistence
```

The `@main` App struct and the first `NavigationStack`/`TabView` under it give the whole
screen graph. View models marked `@Observable` are where the logic actually lives.

## TypeScript / Next.js

```bash
fd -e tsx -e ts "^(page|layout|route|middleware)" app/     # App Router surface
rg -n "export async function (GET|POST|PUT|PATCH|DELETE)" app/
rg -n "\"use server\"" -l                                  # server actions
rg -n "\"use client\"" -l | head                           # the client/server boundary
```

`middleware.ts` runs before everything — if it exists, it's stop 1. The `use client`
boundary is usually the most misunderstood thing in the repo and worth a stop of its own.

## Node

```bash
jq -r '.main, .scripts' package.json
rg -n "app\.(listen|use)|createServer|new Hono|express\(\)" src/
```

## Python

```bash
rg -n "FastAPI\(|APIRouter\(|@app\.(get|post)|@router\." --glob "**/*.py"
rg -n "if __name__ == .__main__.|typer\.Typer\(|click\.group" --glob "**/*.py"
jq -r '.project.scripts' pyproject.toml 2>/dev/null || rg -n "\[project.scripts\]" -A5 pyproject.toml
```

Router registration order matters in FastAPI — read `include_router` calls to get the real
URL tree, not just the decorators.

## Go

```bash
rg -n "^func main\(" --glob "**/*.go"
rg -n "http.HandleFunc|mux.Handle|r.(Get|Post)\(" --glob "**/*.go"
```

## Swift / iOS

```bash
rg -n "@main|@UIApplicationMain" --glob "**/*.swift"
rg -n "WindowGroup|struct.*: App\b" --glob "**/*.swift"
rg -n "@Model|NSManagedObject" --glob "**/*.swift"     # SwiftData / Core Data
```

## Terraform

```bash
fd -e tf . --max-depth 2
rg -n "^module \"|^resource \"" --glob "*.tf" | head -40
rg -n "backend \"" --glob "*.tf"                        # where state lives
```

Tour Terraform by dependency, not by file: root module → its modules → the resources with
the most inbound references.

---

## Stack-independent signals

```bash
# load-bearing files — churn beats size as a signal of what matters
# skip this block entirely if `git rev-parse --git-dir` fails; fall back to mass + seams
git log --format= --name-only --since=6.months.ago | sort | uniq -c | sort -rn | head -20

# mass, excluding noise
fd -e ts -e tsx -e ex -e exs -e py -e go -e swift \
  -E "*_test.*" -E "test_*" -E "node_modules" -E "_build" -E "deps" -E "priv/static" \
  -x wc -l | sort -rn | head -20

# aged debt — a TODO with a year on it is a finding
rg -n "TODO|FIXME|HACK|XXX" -g '!node_modules' -g '!_build' | head -30

# duplicate implementations — two things with the same job
fd -e ts -e ex -e py -x basename {} | sort | uniq -d
```

## Exclusions

Never make a stop out of: lockfiles, generated clients, migrations (unless the walkthrough
is *about* the schema), vendored deps, `priv/static`, `node_modules`, `_build`, `.next`,
snapshot test fixtures.

## Judging a stop

A file earns a stop if at least one is true:

- Execution passes through it on the main path
- It's a seam — two layers or two systems meet there
- It holds a decision the rest of the code is built around
- It's high-churn (people keep having to change it)
- It's surprising — the name says one thing and the body does another

A file does **not** earn a stop for being large, or for being new, or for being the file
the agent happened to read most carefully.
