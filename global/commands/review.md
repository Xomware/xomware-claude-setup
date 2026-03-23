# /review

Review all changed code, clean up issues, and auto-fix where possible.

## Steps

1. Run `git diff --name-only` and `git diff --cached --name-only` to find all changed files (staged + unstaged)
2. If no changes found, check `git diff main --name-only` for branch-level changes
3. For each changed file:
   - Read the full file
   - Check for: dead code, commented-out blocks, unused imports, `any` types (TS), missing error handling, security issues, naming issues, code duplication
4. Run the project's linter if available (`npm run lint`, `mix credo`, `ruff check .`, etc.) — check `package.json`, `mix.exs`, or `pyproject.toml` to detect the right command
5. Run the project's type checker if available (`npm run typecheck` or `tsc --noEmit`)
6. **Auto-fix** everything you can:
   - Remove dead code and commented-out blocks
   - Fix lint errors
   - Fix type errors
   - Improve unclear naming
   - Add missing error handling at boundaries
   - Remove unused imports
7. For things you can't auto-fix, list them with file:line and explain why

## Output Format

### Fixed
- `file:line` — what was fixed and why

### Needs Attention
- `file:line` — what the issue is and why it can't be auto-fixed

### Summary
One line: overall code health verdict.

$ARGUMENTS
