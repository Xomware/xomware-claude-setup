# /commit

Analyze all changed files, stage them, and create a well-formatted commit. Do NOT push.

## Steps

1. Run `git status` to see all changed and untracked files
2. Run `git diff` and `git diff --cached` to understand what changed
3. Read changed files where the diff alone isn't enough context
4. Categorize changes into sections (e.g., Features, Fixes, Refactors, Config, Docs, Tests)
5. Stage all relevant files — but **exclude**:
   - `.env`, credentials, secrets
   - `.DS_Store`, `node_modules/`, build artifacts
   - Anything in `.gitignore`
   - If unsure about a file, ask before staging
6. Write a commit message in this format:

```
<type>: <short summary>

## <Section Title>
- Bullet describing a specific change
- Another bullet

## <Section Title>
- Bullet describing a specific change
```

Where `<type>` is one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`

7. Create the commit. Do NOT push.
8. Show `git log -1` to confirm.

## Rules
- Group related changes under clear section headings
- Each bullet should describe WHAT changed and WHY (briefly)
- Keep the summary line under 72 characters
- Use present tense ("add", "fix", "update" — not "added", "fixed")
- If changes span multiple unrelated concerns, suggest splitting into multiple commits and ask before proceeding
- Never use `git add -A` blindly — review what's being staged

$ARGUMENTS
