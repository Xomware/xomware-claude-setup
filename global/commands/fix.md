# /fix

Quick-fix pipeline for small changes that don't need brainstorm/plan. Use for bug fixes, small features, config changes, and anything under 30 minutes.

## Steps

1. Parse the description: what's broken or what needs to change?
2. Find the relevant files — use grep, glob, read project CLAUDE.md for context
3. Read the code that needs to change
4. Implement the fix
5. Run the project's test suite (detect framework: `npm test`, `mix test`, `pytest -x -v`, etc.)
   - If tests fail, fix and re-run
   - If no test suite exists, skip
6. Run the project's linter if available (`ruff check .`, `mix credo`, `npm run lint`, etc.)
   - Auto-fix lint issues
7. Show a summary of what changed and why

## Output Format

### Fix Applied
- `file:line` — what changed and why

### Tests
- Pass/fail status, or "no test suite detected"

### Lint
- Clean or issues fixed

### Summary
One line: what was wrong and what was done.

## Rules
- Do NOT brainstorm or write plan docs — this is the fast path
- Do NOT create new files unless the fix requires it
- If the fix is bigger than expected (touches 5+ files or needs architectural decisions), stop and recommend `/plan` instead
- Always read before editing — understand the context
- Run tests after every fix

$ARGUMENTS
