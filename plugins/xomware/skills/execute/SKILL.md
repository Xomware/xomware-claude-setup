---
name: execute
description: >
  Act on a written plan doc. Reads docs/features/[feature]/PLAN.md, shows a delegation
  preview of which agents and skills will run, waits for approval, then executes and
  logs progress to EXECUTION_LOG.md. Never runs a plan still marked Draft.
argument-hint: "[feature-name]"
---

# /execute

Use the executor agent to act on a plan doc.

1. Read `docs/features/$ARGUMENTS/PLAN.md`
2. Show the delegation preview — which agents/skills run and in what order
3. Wait for go-ahead
4. Execute, tick off steps in the plan doc, and log progress to EXECUTION_LOG.md

$ARGUMENTS
