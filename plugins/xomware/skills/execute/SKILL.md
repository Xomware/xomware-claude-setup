---
name: execute
description: >
  Act on a written plan doc without GitHub. Reads docs/features/[feature]/PLAN.md, shows a
  delegation preview of which agents and skills will run, waits for approval, then executes
  and logs progress to EXECUTION_LOG.md. Never runs a plan still marked Draft. Use when the
  work does not warrant issues; use /goals + /work-issue when it should be tracked.
argument-hint: "[feature-name]"
---

# /execute

Use the executor agent to act on a plan doc. **The no-GitHub path** — no issues, no board,
no PR loop. Everything stays local to the repo.

Use `/goals` + `/work-issue` instead when the work should be tracked: anything that belongs
on XomBoard, anything spanning multiple sittings, or anything where losing state to a
compaction would hurt.

1. Read `docs/features/$ARGUMENTS/PLAN.md`
2. Refuse if its `Status:` is still `Draft`
3. Show the delegation preview — which agents/skills run and in what order
4. Wait for go-ahead
5. Execute, tick off steps in the plan doc, and log progress to EXECUTION_LOG.md

$ARGUMENTS
