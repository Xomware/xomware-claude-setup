---
name: status
description: >
  Show the state of every feature in docs/features and every goal in flight — status,
  which docs exist, task progress, and when each was last updated.
disable-model-invocation: true
allowed-tools: Read Glob Bash(git log:*)
---

# /status

Show the current state of all features in this project.

## Steps

1. Glob for `docs/features/*/PLAN.md`
2. For each plan doc, read the header to extract:
   - **Title** (from `# ` heading)
   - **Status** (from `Status:` line — Draft, Ready, In Progress, Blocked, Done)
   - **Last modified** (from git or file timestamp)
3. Display a table sorted by status (In Progress first, then Ready, Blocked, Draft, Done)
4. For each feature folder, note which docs exist (RESEARCH, BRAINSTORM, PLAN)
5. Read `GOALS.md`. For each active goal, open its goal file and count tasks by status
6. Flag **archivable** goals — every task `in review` and every PR merged. Check with
   `gh pr view {n} --json state`. These are done and their row should leave `GOALS.md`
7. If `docs/solutions/` exists, show a count per category

## Output Format

```
## Features
| Status      | Feature          | Docs  | Last Updated |
|-------------|------------------|-------|--------------|
| In Progress | feature-name     | R B P | 2026-03-09   |
| Ready       | other-feature    | B P   | 2026-03-08   |
| Draft       | idea             | P     | 2026-03-07   |
| Done        | completed-thing  | R B P | 2026-03-05   |

Docs key: R=Research, B=Brainstorm, P=Plan

## Goals in flight
| Goal          | Tracking | Tasks                       | Status      |
|---------------|----------|-----------------------------|-------------|
| Coverage calc | #142     | 2 done, 1 in review, 3 todo | in progress |

## Archivable (2)
These are complete — all PRs merged. `/goals` prunes them to goals/ARCHIVE.md on its next run.
- Rate limiting (#118)
- Usage dashboard (#131)

## Solutions (N total)
- auth: 3 docs
- deployment: 2 docs
```

If no feature docs exist, say so and suggest `/brainstorm` or `/plan` to get started.
If features exist but no goals are in flight, suggest `/goals [feature]` for anything Ready.

$ARGUMENTS
