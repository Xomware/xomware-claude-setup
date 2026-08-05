---
name: cycle
description: >
  Run the full pipeline in one session — brainstorm, plan, goals, then work tasks to open
  PRs — with a gate between each stage. Use when starting a feature from scratch and you
  want to stay in one session. Do not use for small changes; use /fix.
argument-hint: "[the problem or feature, in a sentence or two]"
disable-model-invocation: true
allowed-tools: Read Write Edit Glob Grep Bash
---

# /cycle

Drive the whole loop for: **$ARGUMENTS**

```
/brainstorm → GATE → /plan → GATE → /goals → GATE → /work-issue
```

This command is thin. Each stage is its own skill and owns its own behaviour — invoke it and
follow it exactly. `/cycle` adds the sequencing, the gates, and the context budget. It does
not reimplement any stage, and it does not shortcut one because there are more to get
through.

**Four stages, three gates, four real answers.** The point of the cycle is speed *between*
stages, not removal of the human *from* them.

## Stage 1 — Brainstorm

Invoke the `brainstorm` skill with `$ARGUMENTS`.

**Interactive by design.** Ask the questions it asks and wait for real answers. Do not answer
on the user's behalf and do not jump to a recommendation to save time.

Skip this stage only if the user's input already names a decided approach.

**Gate 1** — summarize the direction in five bullets or fewer, then ask:
`Ready to plan this? (yes / keep brainstorming / adjust: ...)`

Do not proceed on silence or ambiguity.

## Stage 2 — Plan

Invoke the `plan` skill using the brainstorm output as input.

**Gate 2** — present the plan and ask:
`Approve this plan? (yes / revise: ...)`

On revision, re-run this stage. Plan revisions are cheap; issue churn is not.

On approval, **set the plan's `Status:` to `Ready`** before continuing — `/goals` refuses a
Draft plan, and that check exists for a reason.

## Stage 3 — Goals

Invoke the `goals` skill against the approved plan.

That skill has **its own confirmation** before it creates issues. **Honor it.** Gate 2 was
approval of the plan, not blanket approval to create GitHub issues and board items. Present
the phase/task/issue-count summary and get a separate yes.

Output: a goal file, a tracking issue, task issues on XomBoard, a `GOALS.md` row.

**Gate 3** — ask:
`Start building? (all tasks / first task only / stop here — I'll run /work-issue later)`

`stop here` is a normal, good answer. A goal file with issues is a complete deliverable.

## Stage 4 — Work

Invoke the `work-issue` skill against the goal file, in goal mode.

- `all tasks` → loop until done or blocked
- `first task only` → one task, then stop and report

Honor that skill exactly: tests first and failing for the right reason, whole suite green,
docs and goal file updated, commit leading with the issue number, PR opened and CI watched to
green, task marked `in review`, context checkpoint after each task.

**Never merge.** The cycle ends at open, green PRs.

## Context budget

Four stages in one session, so context is the binding constraint.

- Check `/context` at **every gate**, not just inside Stage 4
- **At ≥60% at any gate:** the current stage's artifact is already on disk (brainstorm, plan,
  and goal file all write files) — `/compact` keeping the artifact paths, then re-read and
  continue
- **Stage 3 is the natural checkpoint.** Once the goal file exists, everything before it is
  disposable. Compact aggressively there
- **At ≥85% mid-task in Stage 4:** finish the current task's disk writes — including the
  pushed branch and open PR — then compact and re-read the goal file before the next task

## Resuming

If `$ARGUMENTS` names an existing goal file, or the user says "resume", **skip to Stage 4**.
Do not re-brainstorm work that is already planned.

If a plan exists but no goal file, start at Stage 3.

## Rules

- Never chain past a gate on your own judgment
- Never write implementation code before Stage 4
- Never create issues before Stage 3's own confirmation
- Never merge a PR
- If an answer at any gate changes the shape of the work, **go back a stage** rather than
  patching forward
- If a stage skill is unavailable, stop and name it. Do not approximate a stage you cannot
  invoke

## Usage

```
/cycle add rate limiting to the completions endpoint
/cycle goals/2026-08-05-rate-limiting.md      — resume at Stage 4
```

$ARGUMENTS
