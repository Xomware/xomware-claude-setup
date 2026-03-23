# /sync-memory

Reconcile session memory with the actual project state. Use at session start when memory is stale or when `/end-session` was skipped.

## Steps

1. Read `.claude/memory/session-log.md` to see last recorded session
2. Read `.claude/CLAUDE.md` for current focus section
3. Run `git log --oneline -20` to see recent commits since last session
4. Run `git diff --stat HEAD~10` to understand scope of recent changes
5. Check `.claude/memory/dirty-files` — if non-empty, a session ended without cleanup
6. Compare git history against session-log to identify gaps (commits not captured in any session entry)
7. For each gap, write a brief catch-up entry to session-log.md:
   ```
   ## Session [date] (backfilled from git)
   ### Changes (from git log)
   - [commit message summary]
   ### Note
   Backfilled — /end-session was not run for this session.
   ```
8. Update the `## Current Focus` section in `.claude/CLAUDE.md` to reflect actual project state
9. Clear `.claude/memory/dirty-files` if it had stale entries

## Output

```
Memory synced.
- Last session: [date]
- Gaps found: [N] sessions without /end-session
- Backfilled: [N] entries
- Current focus updated: [one line summary]
```

$ARGUMENTS
