# xomware-claude-setup

Claude Code configuration for the Xomware org, distributed as a plugin.

This repo is both the **plugin** and its **marketplace**. Installing it registers the
marketplace and pulls the plugin; `claude plugin update` is how you take changes. Nothing
is copied into `~/.claude/` except the two things a plugin cannot carry.

---

## Install

```bash
# one time
claude plugin marketplace add Xomware/xomware-claude-setup
claude plugin install xomware@xomware

# global CLAUDE.md + permissions (a plugin can't ship these)
git clone https://github.com/Xomware/xomware-claude-setup.git ~/Code/xomware-claude-setup
bash ~/Code/xomware-claude-setup/setup.sh
xom-install-claude-setup
```

`setup.sh` links `bin/xom-*` into `~/.local/bin`. That directory must be on your `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Update

```bash
claude plugin marketplace update xomware
claude plugin update xomware@xomware
```

Editing files in `~/.claude/skills/` or `~/.claude/agents/` directly is how this config
drifted before. Change the repo, push, update.

---

## What's in the plugin

| Path | Contents |
|---|---|
| `plugins/xomware/skills/` | 37 skills — engineering standards + the workflow pipeline |
| `plugins/xomware/agents/` | 13 specialist and workflow agents |
| `plugins/xomware/hooks/` | `hooks.json` plus the Bash guard |

### Skills

**Standards** load when Claude is doing the matching kind of work:

`angular-component` · `ts-component` · `frontend-standards` · `ios-standards` ·
`lambda-handler` · `api-route` · `backend-standards` · `python` · `nodejs` · `database` ·
`terraform` · `infra-standards` · `docker-deploy` · `env-config` · `error-handling` ·
`logging` · `testing` · `anthropic-api` · `mcp`

**Workflow** skills are invoked with `/name`:

| | |
|---|---|
| `/research` `/brainstorm` `/plan` `/orchestrate` | the feature pipeline |
| `/execute` | act on a plan locally — no issues, no board, no PRs |
| `/goals` `/work-issue` | the tracked path — goal file, issues, PRs, CI |
| `/cycle` | all four tracked stages in one session, gated between each |
| `/fix` | fast path for changes under ~30 min |
| `/review` `/test` | quality gates — `/review` runs in a forked context |
| `/commit` `/pr` `/backlog` `/board` `/work-issue` | git and XomBoard |
| `/status` `/catchup` `/compound` `/audit-config` `/setup` | project state and config |

Twelve of these set `disable-model-invocation`, so Claude never triggers them on its own —
they run only when you type them.

### Agents

`planner` · `brainstorm` · `researcher` · `executor` · `orchestrator` ·
`backend-specialist` · `frontend-specialist` · `infra-specialist` · `ios-specialist` ·
`code-reviewer` · `debugger` · `compounder` · `meta-agent`

The four specialists preload their relevant standards via the `skills:` frontmatter field,
so the conventions are in context from the first turn rather than discovered mid-task.

---

## Repo layout

```
.claude-plugin/marketplace.json   this repo as a marketplace
plugins/xomware/                  the plugin itself
  .claude-plugin/plugin.json
  skills/  agents/  hooks/
global/                           what the plugin can't ship
  CLAUDE.md                       -> ~/.claude/CLAUDE.md
  settings.json                   -> ~/.claude/settings.json (permissions.deny, models)
bin/                              xom-* helper commands
project-template/                 scaffolding for a new repo's .claude/
docs/                             research and feature docs
```

**Why `global/` is separate:** a plugin's `settings.json` supports only `agent` and
`subagentStatusLine`. `permissions.deny` and the global `CLAUDE.md` have to be installed,
which is all `xom-install-claude-setup` still does.

**Hooks live in exactly one place** — `plugins/xomware/hooks/hooks.json`, addressed through
`${CLAUDE_PLUGIN_ROOT}`. Declaring the same hook here and in `settings.json` fires it twice.

---

## New project

```bash
cd ~/Code/my-project
xom-init-claude-setup
```

Scaffolds `.claude/` from `project-template/`: a `CLAUDE.md` stub, path-scoped rules in
`.claude/rules/`, and a `settings.json` that declares the marketplace so **cloud sessions
and scheduled routines** get the plugin too. Plugins enabled only in user settings don't
reach those environments.

## Memory

Auto memory is on. Claude writes learnings to `~/.claude/projects/<repo>/memory/` itself
and loads the `MEMORY.md` index every session. Audit it with `/memory`.

The previous `/end-session` + `/sync-memory` + `session-log.md` pipeline is retired — it
only recorded anything when you remembered to run the command, and in practice logged
empty stubs.

## Working on this repo

```bash
claude --plugin-dir ./plugins/xomware     # load the working copy, not the installed one
claude plugin validate ./plugins/xomware  # check the manifest
claude plugin validate .                  # check the marketplace
/reload-plugins                           # pick up agent, hook and MCP changes
```

`SKILL.md` edits are picked up live; everything else needs `/reload-plugins`.
