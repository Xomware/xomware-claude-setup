# Claude Setup Audit & Modernization — Research

**Date**: 2026-08-04
**Claude Code version installed**: 2.1.221
**Status**: Research complete — plan pending approval

---

## Part 1 — What is actually wired into your sessions?

### The short answer

`~/.claude/` is the only thing Claude Code reads. It is **not** a git repo and **not** symlinked to any repo — it is a *copy target*. Both `claude-setup` and `xomware-claude-setup` are installers that copy files into it.

Right now `~/.claude/` content matches `xomware-claude-setup/global/` byte-for-byte (CLAUDE.md, all 20 commands, all 19 skills). So **this repo is the de-facto source of truth** — but nothing enforces that, and two things actively fight it.

### Footgun 1 — your global CLI commands point at the OLD repo

```
~/.local/bin/install-claude-setup  ->  /Users/dom/Code/claude-setup/bin/install-claude-setup
~/.local/bin/init-claude-setup     ->  /Users/dom/Code/claude-setup/bin/init-claude-setup
~/.local/bin/update-claude-setup   ->  /Users/dom/Code/claude-setup/bin/update-claude-setup
~/.local/bin/claude-setup          ->  /Users/dom/Code/claude-setup/bin/claude-setup
```

`claude-setup` = `github.com/DominickGiordano/claude-setup`, last commit 2026-03-25 — the pre-fork personal repo.

Running `install-claude-setup` today would overwrite `~/.claude/` from that repo and **reintroduce purged Areté content**: `elixir.md`, `phoenix.md`, `infisical.md`, `microsoft-graph.md`, `backlog-notion.md`, `set-org.md`, `update-notion-task.md`.

Partial evidence this already happened: `~/.claude/skills/` still contains `elixir.md` and `phoenix.md`, which exist in `claude-setup` but not in `xomware-claude-setup`.

### Footgun 2 — `setup.sh` in this repo is broken

`setup.sh:16` loops over `claude-setup install-claude-setup init-claude-setup update-claude-setup`, but `bin/` contains `xom-claude-setup`, `xom-install-claude-setup`, `xom-init-claude-setup`, `xom-update-claude-setup`. With `set -euo pipefail`, the first `chmod +x` on a nonexistent file kills the script. **`bash setup.sh` cannot succeed in this repo.**

### Other Claude repos on this machine

| Repo | Remote | Last commit | Wired into `~/.claude`? |
|---|---|---|---|
| `claude-setup` | DominickGiordano/claude-setup | 2026-03-25 | **Yes — via `~/.local/bin` symlinks** |
| `xomware-claude-setup` | Xomware/xomware-claude-setup | 2026-08-04 | Content matches, but no live link |
| `xom-claude-agents` | Xomware | 2026-03-03 | No |
| `xom-claude-skills` | Xomware | 2026-03-03 | No |
| `xom-claude-workflows` | Xomware | 2026-03-01 | No |
| `xom-claude-mcp-tools` | Xomware | 2026-03-03 | No |
| `vest-claude-skills` | domgiordano | 2026-06-04 | No (separate product) |

The four `xom-claude-*` repos are all ~5 months stale and contribute nothing to any session. `vest-claude-skills` is the only repo on the machine using the **correct modern skill format** (`<name>/SKILL.md`).

Also live but **untracked in any repo**: 6 agents in `~/.claude/agents/` — `forge`, `patch`, `pixel`, `sable`, `scout`, `vex` (dated 2026-05-27). They exist nowhere in git.

---

## Part 2 — The big finding: all 19 global skills are dead

### The problem

`~/.claude/skills/` contains 19 flat `.md` files. Claude Code requires:

```
~/.claude/skills/<skill-name>/SKILL.md
```

A flat `~/.claude/skills/python.md` is **not discovered at all**. It is not a skill, not a command, not loaded, not indexed.

### Verification

This session's loaded-skill list contains the 20 files from `~/.claude/commands/` (`/plan`, `/fix`, `/execute`…), the Vercel plugin skills, and Anthropic's bundled skills. It contains **zero** of:

`anthropic-api`, `api-route`, `backend-standards`, `database`, `docker-deploy`, `elixir`, `env-config`, `error-handling`, `frontend-standards`, `infra-standards`, `ios-standards`, `logging`, `mcp`, `nodejs`, `phoenix`, `python`, `terraform`, `testing`, `ts-component`

That is roughly **2,000 lines of carefully written Xomware standards that have never once loaded** — including the iOS design & UX standards added in PR #2 today.

Every project-level `.claude/skills/` directory is also empty (`Float`, `waf`, `docs`, `xomware-infrastructure`, `xom-*`, `xomcloud-frontend`, `xomper-front-end`, `xomfit-infrastructure`). Same failure mode.

### Why the commands still work

`.claude/commands/*.md` flat files are still supported — custom commands were **merged into skills**, and the legacy `commands/` path is preserved. That's why `/plan` and `/fix` work while `python.md` does nothing. It masks the skills failure.

---

## Part 3 — What's changed in Claude Code since this was built

Built ~Mar 2026 against Claude Code 1.x/early-2.0 conventions. Current is 2.1.221.

### Skills

- Custom commands **merged into skills**. `.claude/commands/x.md` and `.claude/skills/x/SKILL.md` both create `/x`. Skills are the recommended path.
- Skills follow the [agentskills.io](https://agentskills.io) open standard.
- Skill directories support **supporting files** — templates, scripts, reference docs — loaded on demand (progressive disclosure), so long reference material costs ~0 tokens until used.
- **Live change detection**: edits to `SKILL.md` are picked up mid-session, no restart.
- New frontmatter worth using:

| Field | What it buys us |
|---|---|
| `paths` | Glob-scoped auto-activation — `python` skill loads only when touching `**/*.py` |
| `disable-model-invocation` | Manual-only workflows (`/commit`, `/pr`) don't burn context on every turn |
| `user-invocable: false` | Background standards hidden from the `/` menu |
| `context: fork` + `agent` | Run the skill in a subagent instead of the main context |
| `background: false` | Wait for the forked result inline (v2.1.218+) |
| `allowed-tools` / `disallowed-tools` | Pre-approve or forbid tools for the invoking turn |
| `model` / `effort` | Per-skill model + effort override (`low` for mechanical, `max` for review) |
| `argument-hint` / `arguments` | Autocomplete hints and named `$issue` / `$branch` substitution |
| `hooks` | Hooks scoped to the skill's own lifecycle |

- `description` + `when_to_use` are truncated at **1,536 chars** in the skill listing. Our current descriptions front-load trigger phrases, which is right — but they need to live in `SKILL.md`.
- Skill bodies stay in context across turns once loaded — every line is a recurring cost. Several of our skills are long enough that they should split into `SKILL.md` + reference files.
- **`~/.claude/skills/` does not reach Cowork, cloud sessions, or scheduled routines.** Only account-enabled skills, repo-committed `.claude/skills/`, or plugin-shipped skills do.

### Subagents

- New frontmatter since our agents were written: `skills` (preload full skill content at startup), `isolation: worktree`, `effort`, `permissionMode`, `disallowedTools`, `maxTurns`, `mcpServers`, `background`, `initialPrompt`, `memory`.
- `skills:` preload is the direct fix for our dead-standards problem — `backend-specialist` can preload `python` + `error-handling` + `logging` so the standards are *in context*, not merely discoverable.
- Subagents run in the **background by default** as of 2.1.198; spawn depth default raised to 3.
- `color` must be a **named** color (`red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`). `~/.claude/agents/vex.md` uses `color: "#2563eb"` — invalid.
- Agent `name` cannot contain `:` (reserved for plugin scoping); files with one are silently not loaded as of v2.1.218.
- The `/agents` creation wizard was **removed** — edit `.claude/agents/` directly.
- `/verify` and `/code-review` no longer auto-run.

### Memory & rules

- `.claude/rules/` with `paths:` frontmatter is still fully supported and is the recommended way to keep CLAUDE.md under 200 lines. **`~/.claude/rules/` does not exist on this machine** — user-level path-scoped rules are unused.
- **Auto memory** is on by default and writes to `~/.claude/projects/<project>/memory/` with a `MEMORY.md` index (first 200 lines / 25KB loaded per session). This overlaps heavily with our hand-rolled `.claude/memory/session-log.md` + `/end-session` + `/sync-memory` machinery.
- `/doctor` now proposes CLAUDE.md trims (v2.1.206+).
- `claudeMdExcludes` setting for noisy ancestor CLAUDE.md files.

### Plugins — the modern distribution model

A plugin is a directory that can bundle **all** of it:

| Path | Contents |
|---|---|
| `.claude-plugin/plugin.json` | Manifest — name, version, description |
| `skills/<name>/SKILL.md` | Skills |
| `agents/*.md` | Subagents |
| `hooks/hooks.json` | Hooks (same JSON shape as `settings.json`) |
| `.mcp.json` | MCP servers |
| `.lsp.json` | LSP servers |
| `monitors/monitors.json` | Background log/file watchers |
| `bin/` | Executables added to Bash `PATH` while enabled |
| `settings.json` | Default settings (`agent`, `subagentStatusLine`) |

Distributed via a marketplace — which can be a **private GitHub repo**. Install once with `/plugin install xomware@xomware`, update with `/plugin update`. Versioned via `plugin.json`.

This replaces the entire `bin/xom-install-claude-setup` copy-files approach and fixes the drift problem structurally: there is no local copy to drift.

Also: `claude plugin init <name>` scaffolds a plugin directly inside `~/.claude/skills/`, which auto-loads as `<name>@skills-dir` with no marketplace at all — a good intermediate step.

### Settings & platform

- `sandbox.credentials` (credential masking), `sandbox.network.strictAllowlist`, `sandbox.allowAppleEvents`.
- `autoMode.classifyAllShell`.
- `/config key=value` from the prompt.
- New `DirectoryAdded` hook; `InstructionsLoaded` hook for debugging which instruction files loaded.
- Permission rule change: single-segment `dir/**` now matches only `<cwd>/dir/` — use `**/dir/**` for any depth. **Our `permissions.deny` uses `Read(**/.env)` — correct. No action needed.**
- Hook matchers: hyphenated identifiers now exact-match instead of substring-match.
- `Task` tool `mode` param deprecated — subagents inherit parent permission mode.

---

## Part 4 — Additional defects found

| # | Issue | Impact |
|---|---|---|
| 1 | 19 global skills in flat `.md` — never load | **Critical.** All standards dead. |
| 2 | `~/.local/bin/*` → old `claude-setup` repo | **Critical.** One command re-pollutes global config. |
| 3 | `setup.sh` name mismatch with `bin/xom-*` | **High.** Repo's own bootstrap is broken. |
| 4 | 6 agents live only in `~/.claude`, untracked | **High.** Unrecoverable if `~/.claude` is wiped. |
| 5 | 20 agents with ~2× redundancy | `patch`≈`debugger`, `pixel`≈`frontend-specialist`, `sable`≈`code-reviewer`, `scout`≈`researcher`, `vex`≈`backend`+`frontend`, `forge`≈`infra-specialist`. Ambiguous delegation. |
| 6 | `vex.md` has `color: "#2563eb"` | Invalid — must be a named color. |
| 7 | `global/hooks/check-runtime.sh` orphaned | In repo, never installed, referenced by no settings file. |
| 8 | `elixir.md` / `phoenix.md` in `~/.claude/skills` | Areté leftovers not purged from the live install. |
| 9 | No `README.md` in this repo | Old repo has README, ONBOARDING, docs/, examples/. All lost in the fork. |
| 10 | `~/.claude/rules/` unused | Global CLAUDE.md carries content that should be path-scoped. |
| 11 | `settings.json` has `subagentModel: "sonnet"` | Every subagent is pinned to Sonnet regardless of task difficulty. `effort`/per-agent `model` is the finer-grained tool now. |
| 12 | Hand-rolled session memory vs built-in auto memory | Duplicated mechanism; ours only fires on `Stop` hook and produces empty stubs (see `.claude/memory/session-log.md`). |
| 13 | 4 stale `xom-claude-*` repos | Dead weight, unclear ownership, ~5 months untouched. |

---

## Part 5 — Proposed plan

### Phase 0 — Stop the bleeding *(~10 min, do first regardless)*
1. Repoint `~/.local/bin/*` symlinks at `xomware-claude-setup/bin/xom-*`.
2. Fix `setup.sh` to use the `xom-` prefixed names.
3. Delete `elixir.md` / `phoenix.md` from `~/.claude/skills/`.
4. Commit the 6 untracked agents into the repo *before* anything can overwrite them.
5. Archive `DominickGiordano/claude-setup` on GitHub so it can't be re-installed by muscle memory.

### Phase 1 — Resurrect the skills *(highest value)*
6. Convert all 17 Xomware skills to `skills/<name>/SKILL.md` directories.
7. Add `paths:` scoping so language/domain skills auto-load only on matching files (`python` → `**/*.py`, `terraform` → `**/*.tf`, `ios-standards` → `**/*.swift`).
8. Split any skill over ~150 lines into `SKILL.md` + `references/` supporting files.
9. Verify with `/context` that they actually load.

### Phase 2 — Consolidate the agent roster
10. Merge the duplicate pairs down to one canonical agent each — target ~10 agents from 20.
11. Add `skills:` preload to each specialist so standards land in context.
12. Fix `vex.md` color; audit all frontmatter against the current field list.
13. Add `isolation: worktree` where agents write files in parallel, `effort` tiers per agent.

### Phase 3 — Commands → skills
14. Migrate `commands/*.md` to `skills/<name>/SKILL.md`.
15. Add `disable-model-invocation: true` to manual-only workflows (`/commit`, `/pr`, `/end-session`).
16. Add `argument-hint`, `arguments`, `allowed-tools` where it removes permission prompts.
17. Use `context: fork` for the heavyweight ones (`/research`, `/review`) so they don't flood main context.

### Phase 4 — Repackage as a plugin + private marketplace
18. Restructure the repo as a plugin: `.claude-plugin/plugin.json`, `skills/`, `agents/`, `hooks/hooks.json`, `settings.json`.
19. Add `.claude-plugin/marketplace.json` so `Xomware/xomware-claude-setup` *is* the marketplace.
20. Install with `/plugin marketplace add Xomware/xomware-claude-setup` + `/plugin install xomware@xomware`.
21. Retire `bin/xom-install-claude-setup` — no more copying, no more drift.
22. Declare the plugin in project `.claude/settings.json` so it reaches cloud sessions and routines.

### Phase 5 — Cleanup
23. Decide the fate of the 4 stale `xom-claude-*` repos — fold the useful parts in, archive the rest.
24. Write a real `README.md`.
25. Evaluate replacing the hand-rolled `session-log.md` / `/end-session` machinery with built-in auto memory.
26. Move procedural content out of global `CLAUDE.md` into `~/.claude/rules/` with `paths:` scoping.

---

## Open questions

1. **Scope** — all five phases, or Phase 0+1 now (fix what's broken) and the rest later?
2. **Plugin vs standalone** — plugin namespaces skills as `/xomware:plan` instead of `/plan`. Acceptable, or keep short names via standalone `~/.claude/`?
3. **Agent roster** — merge the duplicates, or keep both sets deliberately (tracked "role" agents + personality-named ones)?
4. **The 4 `xom-claude-*` repos** — fold in, archive, or leave alone?
5. **Auto memory** — adopt the built-in and retire `/end-session`+`/sync-memory`, or keep the custom pipeline?
