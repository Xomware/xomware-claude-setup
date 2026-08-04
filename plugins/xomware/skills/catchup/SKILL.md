---
name: catchup
description: >
  Resume context at the start of a session: reconcile what auto memory recorded against
  what git actually shows, then summarize what was last worked on, what decisions were
  made, and what is next. Use when picking a project back up after time away.
disable-model-invocation: true
allowed-tools: Read Glob Bash(git log:*) Bash(git status:*) Bash(git diff:*) Bash(git branch:*)
---

# /catchup

Reconstruct where this project left off.

## Steps

1. Read the project's `.claude/CLAUDE.md` for stack, conventions, and current focus.
2. Consult auto memory for this repo — the `MEMORY.md` index, plus any topic file it
   points at that looks relevant. The index is already loaded at session start, so treat
   it as context you have rather than something to re-read in full.
3. Establish ground truth from git, which never goes stale:
   - `git branch --show-current` and `git status --short` — where you are, what's dirty
   - `git log --oneline -15` — what actually landed
   - `git log --oneline main..HEAD` — what's on this branch and not yet merged
4. Check `docs/features/*/PLAN.md` for any plan not marked Done.
5. Reconcile. Where memory and git disagree, git wins — say so explicitly rather than
   repeating a stale note.

## Output Format

```
Branch:    [name] ([N] ahead of main, [clean / N files dirty])
Last work: [what the recent commits actually did]

In flight:
  [ ] [open plan or unfinished thread]

Next steps:
  [ ] ...

Stale memory:
  - [anything auto memory claims that git contradicts, or "none"]
```

If there are no recent commits and no open plans, say so plainly and suggest
`/brainstorm` or `/plan` rather than inventing context.

$ARGUMENTS
