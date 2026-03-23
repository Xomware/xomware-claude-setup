# /test

Run the project's test suite, diagnose failures, and fix what you can.

## Steps

1. Detect the project's test framework:
   - Check `package.json` for `jest`, `vitest`, `mocha`, or a `test` script
   - Check `mix.exs` for ExUnit
   - Check `pyproject.toml` / `setup.cfg` for pytest
   - Check for `Makefile` test targets
2. Run the test suite using the detected command (e.g., `npm test`, `mix test`, `pytest -x -v`)
3. If all tests pass: report the result and stop
4. If tests fail:
   - Read each failing test and the code it tests
   - Determine if the failure is in the test or the implementation
   - **Fix the implementation** if the test expectation is correct
   - **Fix the test** only if the test is clearly wrong (outdated assertion, wrong mock, etc.)
   - Re-run the test suite to confirm the fix
5. If there are changed files with no test coverage:
   - List them and ask if I should write tests

## Rules
- Never delete or skip a failing test to make the suite pass
- Fix the root cause, not the symptom
- If a fix is ambiguous, explain the options and ask before changing
- Run tests with verbose output so failures are clear

## Output Format

### Test Results
- **Pass**: X tests passed
- **Fail**: X tests failed (if any)

### Fixes Applied
- `file:line` — what was wrong and what was fixed

### No Coverage
- Files with changes but no tests (if any)

$ARGUMENTS
