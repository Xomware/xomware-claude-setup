# /catchup

Resume context from last session.

1. Read `.claude/memory/session-log.md`
2. Read `.claude/CLAUDE.md` for project context
3. Summarize: what was last worked on, decisions made, and what's next
4. List any open checkboxes from the last session entry

Output format:
```
Last session: [date]
Status: [what was being built]
Next steps:
  [ ] ...
  [ ] ...
Open questions:
  - ...
```

$ARGUMENTS
