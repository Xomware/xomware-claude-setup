# xomware-claude-setup

> This file is loaded into every Claude session. Keep it lean and accurate.

Active work: @GOALS.md

<!-- The line above is the ONLY in-flight state that belongs in this file. Never append
     work logs, goal entries, or status here — that lives in GOALS.md and goals/*.md.
     See project-template/docs/reference/goal-file-format.md. -->

## What This Is

The Claude Code configuration for the Xomware org. Ships the `xomware` plugin — skills,
agents, and hooks — through a GitHub plugin marketplace, plus a `project-template/` that
`xom-init-claude-setup` scaffolds into new repos.

This repo configures every other repo. A mistake here propagates everywhere.

## Stack

Markdown, JSON manifests, and bash. No application code, no test framework.

## Key Commands

```bash
claude --plugin-dir ./plugins/xomware     # load the working copy, not the installed one
claude plugin validate ./plugins/xomware  # check the plugin manifest
claude plugin validate .                  # check the marketplace manifest
```

## Important Paths

| Path | What |
| ---- | ---- |
| `plugins/xomware/skills/` | Skill definitions — the `/commands` |
| `plugins/xomware/agents/` | Specialist and pipeline agents |
| `plugins/xomware/.claude-plugin/plugin.json` | Plugin version — bump to deploy |
| `.claude-plugin/marketplace.json` | Marketplace manifest — version must match plugin.json |
| `project-template/` | Scaffolded into new repos by `xom-init-claude-setup` |
| `global/` | User-level CLAUDE.md and settings |
| `bin/` | Install and update scripts |

## Project Config

```yaml
pm_tool: github-projects
github_project_number: 2
github_project_owner: Xomware
base_branch: main
goals_dir: goals
dev_domain: infra
test_commands:
  - claude plugin validate ./plugins/xomware
  - claude plugin validate .
```

## Constraints

- **Deploying requires a version bump.** The plugin cache is keyed by version
  (`~/.claude/plugins/cache/xomware/xomware/<version>/`). Merging to `main` alone changes
  nothing — bump both `plugin.json` and `marketplace.json`, and keep them identical.
- **Editing `plugins/` does not affect the running session.** That loads from the installed
  cache. Use `claude --plugin-dir ./plugins/xomware` to test a working copy.
- Changes to `project-template/` only reach repos scaffolded or updated afterwards.
- Branch protection is on: PRs required, no direct pushes to `main`.

## Lessons

- Do NOT resolve a XomBoard item by issue number alone. The board spans every Xomware repo,
  so `#5` matches several items — filter on `repository` too, or `item-edit` silently
  updates the wrong card.
- Do NOT reference `/end-session` or `/sync-memory`. Both were retired; auto memory replaced
  them. Check a command exists in `plugins/xomware/skills/` before documenting it.
- Do NOT edit JSON manifests with `json.dumps` — it escapes `—` and `→` to `\uXXXX`. Do a
  targeted string replace instead.
