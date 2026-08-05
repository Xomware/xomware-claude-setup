---
name: map
description: >
  Generate or refresh per-directory README maps so agents can locate code without reading
  whole repos. Pointer-style, with a git tree SHA footer so drift is detectable. Run
  /map --check to report stale maps without writing anything.
argument-hint: "[directory, --check, or blank to refresh stale maps]"
disable-model-invocation: true
allowed-tools: Read Write Edit Glob Grep Bash(git:*)
---

# /map

Build the navigable context layer — short `README.md` files that tell an agent where things
are, so it can jump straight to the right file instead of reading the repo.

**A stale map is worse than no map.** Without one, an agent greps and finds truth. With a
wrong one, it trusts the map, skips the grep, and edits the wrong file confidently. Every
rule below exists to slow that decay.

## The rule that matters: pointers, not prose

Prose describing *behaviour* rots within weeks of active development. Pointers to *locations*
survive refactors that invalidate the prose.

| | |
| --- | --- |
| Rots fast | "Auth uses a JWT interceptor that refreshes on 401 and retries once." |
| Survives | "Auth: `src/app/core/auth/` — entry `auth.interceptor.ts`, guard `auth.guard.ts`" |

Bias every map toward locations, entry points, and names. Reserve prose for invariants that
genuinely do not change — a boundary that must not be crossed, an ordering that must hold.

If you cannot state something as a pointer or an invariant, leave it out. The map is an index,
not documentation.

## What to map

Only directories that are **both**:

1. More than ~5 files, and
2. Not obvious from the directory name

`src/app/shared/pipes/` needs no map. `src/app/core/` does. When unsure, skip it — an
unmapped directory costs one grep; a wrong map costs a bad edit.

Never map: `node_modules/`, `dist/`, `build/`, `.git/`, generated output, vendored code.

## Modes

### `/map --check` — report drift, write nothing

For every `README.md` carrying a map footer:

```bash
git rev-parse HEAD:{dir}
```

Compare to the `tree:` value in the footer. Different → stale.

```
Stale maps (3):
  src/app/core/            last mapped 2026-07-02, 14 commits ago
  lambdas/common/          last mapped 2026-06-11, 31 commits ago
  src/app/features/admin/  last mapped 2026-07-28, 2 commits ago

Unmapped candidates (2):
  src/app/features/billing/   9 files, no README
  lambdas/reports/            7 files, no README

Run /map to refresh, or /map <dir> for one.
```

This is cheap — pure git, no file reading, no model calls. Safe to run often, and a good
`PostToolUse` hook target.

### `/map {dir}` — regenerate one directory

### `/map` — regenerate everything currently stale

Not everything that exists. Untouched directories keep their maps. If nothing is stale, say so
and stop.

## Generating a map

1. List the directory's files. Read enough of each to name its role — usually the exports,
   the class or component name, and the top-level comment. **Do not read every file end to
   end**; this is an index
2. Identify entry points: what an outside caller reaches first
3. Note links out — which other mapped directories this one depends on
4. Write `{dir}/README.md`

```markdown
# {dir name}

{One or two lines: what lives here and why it is one directory.}

## Entry points

| File | Role |
| ---- | ---- |
| `auth.interceptor.ts` | Attaches bearer token, refreshes on 401 |
| `auth.guard.ts` | Route guard — redirects unauthenticated to /login |

## Also here

- `token-store.service.ts` — token persistence
- `models/` — `AuthUser`, `TokenPair`

## Depends on

- `src/app/core/http/` — the interceptor chain this registers into

## Invariants

- Refresh must happen before any retry; ordering is load-bearing

<!-- map-generated: {YYYY-MM-DD} tree:{git rev-parse HEAD:{dir}} -->
```

Omit any section with nothing real to say. An empty **Invariants** heading is noise — most
directories have none.

## Where this sits

| Layer | File | Maintained by | Content |
| --- | --- | --- | --- |
| Repo | `docs/architecture.md` | Hand-tended, rare edits | Stack, boundaries, invariants |
| Area | `{dir}/README.md` | `/map` | Locations and entry points |
| Task | `goals/*.md` | `/goals`, `/work-issue` | Current work |

`/map` does not touch `docs/architecture.md`. That file holds decisions and reasoning a
generator cannot infer, and hand-tending is what keeps it worth reading.

## Rules

- **Never auto-regenerate on every edit.** That burns tokens on churn. Flag drift, regenerate
  deliberately
- Never write a map for a directory that does not meet both criteria above
- Never describe behaviour that a refactor would invalidate — point at the file instead
- Never overwrite a hand-written `README.md` that has no map footer. Report it and skip;
  a human wrote that on purpose
- Never claim a file does something without having read enough of it to know
- If a directory's purpose is genuinely unclear after reading it, say so in the output rather
  than inventing a coherent-sounding summary

## Usage

```
/map --check              — report stale and unmapped, write nothing
/map                      — refresh everything stale
/map src/app/core         — refresh one directory
```

$ARGUMENTS
