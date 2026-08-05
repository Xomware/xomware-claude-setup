# Remove references to the retired /end-session command — Goals

**Created:** 2026-08-05
**Source plan:** docs/features/dead-command-refs/PLAN.md
**Tracking issue:** #8
**Repo:** Xomware/xomware-claude-setup
**Base branch:** main
**Status:** not started

## Objective

The goals pipeline docs reference `/end-session` as the owner of goal archiving. That command
was retired when auto memory replaced the `session-log.md` pipeline. After this, no doc points
at a command that does not exist, and archiving is owned by two skills that already touch the
files involved.

## Success criteria

- [ ] `grep -rn "end-session" --include='*.md' .` returns nothing outside `docs/features/`
- [ ] Goal archiving has a named owner that actually exists
- [ ] `claude plugin validate ./plugins/xomware` passes
- [ ] `claude plugin validate .` passes

## Non-goals

- Reviving `/end-session` in any form
- Changing how auto memory works
- Adding a command whose only job is pruning

## Constraints and context

No test framework — this repo is markdown, JSON manifests, and bash. Verification is grep
plus the two `claude plugin validate` calls in `test_commands`.

Editing `plugins/` does not affect the running session; that loads the installed cache.
Deploying requires bumping both `plugin.json` and `marketplace.json`.

---

## Phase 1 — Correct the references

**Outcome:** No doc references a command that does not exist.

### Task 1.1 — Replace /end-session references with the real owner

- **Issue:** #9
- **Status:** `todo`
- **Depends on:** none
- **Files:** `project-template/GOALS.md`, `project-template/goals/ARCHIVE.md`,
  `project-template/docs/reference/goal-file-format.md`,
  `project-template/docs/reference/file-structure.md`,
  `plugins/xomware/skills/goals/SKILL.md`
- **Approach:**
  - Replace each `/end-session` mention with `/goals` (the pruner) or `/status` (the reporter)
  - Fix the pipeline line in `goals/SKILL.md` — it ends at `/end-session`
  - Leave `README.md` alone; its mention correctly describes the retirement as history

**Tests (no framework — these are the checks):**

- `grep -rn "end-session" --include='*.md' .` — nothing outside `docs/features/`
- `claude plugin validate ./plugins/xomware` — passes
- `claude plugin validate .` — passes

**Definition of done:**

- [ ] Every reference replaced
- [ ] Grep clean
- [ ] Both manifests validate
- [ ] Committed, pushed, PR opened, CI green

---

## Phase 2 — Give archiving an owner

**Outcome:** Completed goals leave `GOALS.md` without a command existing solely to move them.

### Task 2.1 — Give goal archiving a real owner

- **Issue:** #10
- **Status:** `todo`
- **Depends on:** #9
- **Files:** `plugins/xomware/skills/status/SKILL.md`, `plugins/xomware/skills/goals/SKILL.md`
- **Approach:**
  - `/status` — report goals whose PRs are all merged as archivable
  - `/goals` — prune those rows to `goals/ARCHIVE.md` at the start of its next run
  - No new command

**Tests:**

- `claude plugin validate ./plugins/xomware` — passes
- Read-through: the prune step names both files and cannot run before the confirmation gate

**Definition of done:**

- [ ] `/status` reports archivable goals
- [ ] `/goals` prunes on next run
- [ ] No new command created
- [ ] Committed, pushed, PR opened, CI green

---

## Progress log

| Date | Task | Issue | PR | Commit | Notes / gotchas |
| ---- | ---- | ----- | -- | ------ | --------------- |

## Open questions / deferred

- `gh project item-add` exits 0 but silently adds nothing on this org project. GraphQL
  `addProjectV2ItemById` works. Every skill that adds board items uses the broken form —
  worth its own issue.
