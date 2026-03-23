# /end-session

Use the memory-updater agent to summarize this session.

1. Read `.claude/memory/dirty-files` for changed files
2. Review what was built or discussed
3. Append a structured summary to `.claude/memory/session-log.md`
4. Clear `.claude/memory/dirty-files`
5. Confirm: "Session logged. [N] files changed. Next steps: [...]"

$ARGUMENTS
