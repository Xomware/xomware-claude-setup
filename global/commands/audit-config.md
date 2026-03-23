# /audit-config

Check the health of this project's Claude configuration. Flag issues, suggest improvements.

## Steps

1. **Read `.claude/CLAUDE.md`** — count lines
   - Under 200: OK
   - 200-250: WARNING — recommend splitting to `.claude/rules/`
   - Over 250: CRITICAL — must split before it degrades Claude's attention

2. **Check for stale content**:
   - Does `## Current Focus` exist? Is it empty or still a template placeholder?
   - Are there `[bracket placeholders]` that were never filled in?
   - Does the stack section match what's actually in `package.json` / `mix.exs` / `pyproject.toml`?

3. **Check for path-scopeable content**:
   - Scan CLAUDE.md for sections that reference specific directories (e.g., `src/api/`, `frontend/`, `tests/`)
   - Suggest moving those to `.claude/rules/[name].md` with appropriate `paths:` frontmatter

4. **Check `.claude/rules/`**:
   - Does the directory exist?
   - If rules files exist, do they all have valid `paths:` frontmatter?
   - Is `EXAMPLE.md` still there? (suggest deleting after real rules are added)

5. **Check session memory health**:
   - Does `.claude/memory/session-log.md` exist?
   - How many empty stubs vs real entries? Flag if stubs > entries.
   - Is session-log.md over 200 lines? Suggest summarizing old entries.

6. **Check settings.json**:
   - Does it have `permissions.deny` rules? If not, warn.
   - Are `.env` reads denied? If not, flag.

7. **Report** in this format:

```
## Config Health Report

| Check | Status | Action |
|-------|--------|--------|
| CLAUDE.md size | OK (142 lines) / WARN / CRITICAL | — / Split to rules/ |
| Current Focus | Fresh / Stale / Missing | Update via /end-session |
| Path-scopeable content | None / Found 3 sections | Move to rules/ |
| Rules directory | Present / Missing | Create .claude/rules/ |
| Session memory | Healthy / N stubs to clean | Run /sync-memory |
| Permissions | Deny rules present / Missing | Add deny rules |

### Suggested Actions
1. [most impactful fix first]
2. [...]
```

$ARGUMENTS
