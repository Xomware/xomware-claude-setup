# Remove references to the retired /end-session command — Goals

**Created:** 2026-08-05
**Source plan:** docs/features/dead-command-refs/PLAN.md
**Tracking issue:** #8
**Repo:** Xomware/xomware-claude-setup
**Base branch:** main
**Status:** done

## Objective

The goals pipeline docs reference `/end-session` as the owner of goal archiving. That command
was retired when auto memory replaced the `session-log.md` pipeline. After this, no doc points
at a command that does not exist, and archiving is owned by two skills that already touch the
files involved.

## Success criteria

- [x] No doc *instructs* the reader to run `/end-session`
- [x] Goal archiving has a named owner that actually exists
- [x] `claude plugin validate ./plugins/xomware` passes
- [x] `claude plugin validate .` passes

> **Criterion corrected 2026-08-05.** Originally written as "grep returns nothing outside
> `docs/features/`". That could never pass — the README describes the retirement as history,
> this goal file describes the work, and `.claude/CLAUDE.md` carries a lesson naming it. The
> real criterion is that nothing *directs* you to a command that does not exist.

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
- **Status:** `in review`
- **PR:** #12
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

- [x] Every reference replaced
- [x] Grep clean of instructional uses
- [x] Both manifests validate
- [x] Committed, pushed, PR opened (no CI configured on this repo)

---

## Phase 2 — Give archiving an owner

**Outcome:** Completed goals leave `GOALS.md` without a command existing solely to move them.

### Task 2.1 — Give goal archiving a real owner

- **Issue:** #10
- **Status:** `in review`
- **PR:** #12
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

- [x] `/status` reports archivable goals
- [x] `/goals` prunes on next run
- [x] No new command created
- [x] Committed, pushed, PR opened (no CI on this repo)

---

## Progress log

| Date | Task | Issue | PR | Commit | Notes / gotchas |
| ---- | ---- | ----- | -- | ------ | --------------- |
| 2026-08-05 | 1.1 | #9 | #12 | see PR | Success criterion as written could never pass — grep also matches legitimate historical mentions. Corrected above. |
| 2026-08-05 | 2.1 | #10 | #12 | see PR | Scope grew: XomBoard is unused, so board steps are now gated behind `pm_tool` and default off across /goals, /work-issue, /backlog. |

## Deviations from the goal file

- **Tasks 1.1 and 2.1 shipped in one PR (#12), not one each.** The skill says one task, one
  branch, one PR. 2.1 was committed onto 1.1's branch by mistake. Left folded rather than
  split retroactively — they are both small and 2.1 depends on 1.1 — but the rule is right
  and this is the failure it is meant to prevent.
- **Task 2.1's scope grew.** It was "give archiving an owner"; it also gated XomBoard behind
  `pm_tool` after the board turned out to be unused. That belonged in its own task.

## Open questions / deferred

- `gh project item-add` exits 0 but silently adds nothing on this org project. Resolved by
  switching the three skills to the GraphQL `addProjectV2ItemById` mutation — though the path
  is now off by default anyway, since the board is unused.
