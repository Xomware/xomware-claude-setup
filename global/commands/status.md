# /status

Show the current state of all features in this project.

## Steps

1. Glob for `docs/features/*/PLAN.md`
2. For each plan doc, read the header to extract:
   - **Title** (from `# ` heading)
   - **Status** (from `Status:` line — Draft, Ready, In Progress, Blocked, Done)
   - **Last modified** (from git or file timestamp)
3. Display a table sorted by status (In Progress first, then Ready, Blocked, Draft, Done)
4. For each feature folder, note which docs exist (RESEARCH, BRAINSTORM, PLAN, EXECUTION_LOG)
5. If `docs/solutions/` exists, show a count per category

## Output Format

```
## Features
| Status | Feature | Docs | Last Updated |
|--------|---------|------|-------------|
| 🔵 In Progress | feature-name | R B P E | 2026-03-09 |
| 🟢 Ready | other-feature | B P | 2026-03-08 |
| ⚪ Draft | idea | P | 2026-03-07 |
| ✅ Done | completed-thing | R B P E | 2026-03-05 |

Docs key: R=Research, B=Brainstorm, P=Plan, E=Execution Log

## Solutions (N total)
- auth: 3 docs
- deployment: 2 docs
```

If no feature docs exist, say so and suggest `/brainstorm` or `/plan` to get started.

$ARGUMENTS
