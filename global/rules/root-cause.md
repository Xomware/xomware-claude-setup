# Root-Cause Investigations

## First: is the fix actually live?

When a bug is still happening after a fix, **check merge and deploy state before
saying anything about why.** Never offer "the PR probably hasn't merged yet", "it
may not be deployed", or "give it a few minutes" as an explanation — that is a
guess that reads as an answer, and it stalls the investigation while the real
cause sits unexamined.

Verify, in this order:

```bash
gh pr view <n> --json number,state,mergedAt,mergeCommit,baseRefName,headRefName
git fetch --quiet origin && git branch -r --contains <merge-sha>   # which branches have it
gh run list --branch <base-branch> --limit 5                       # did the deploy run, did it pass
```

Then say which it is:

- **Not merged** → say so with the PR state, and stop guessing about behaviour.
- **Merged but deploy failed or hasn't run** → name the failing run. That's the answer.
- **Merged AND deployed AND the bug persists** → the fix was WRONG. Say that plainly.
  Do not wait, do not re-explain the original theory, and do not ship a second guess.
  Go get diagnostic data (below).

"Still broken" plus "merged and deployed" is evidence about the fix, not about the
deploy. Treat it that way.

## Then: don't guess twice

- When fixing a bug whose cause is unknown: if your FIRST PR doesn't resolve it,
  STOP. Do not ship a second guess.
- Before the second attempt: get diagnostic data — run the project's diagnostic
  tooling, write a self-contained query, or add a log line on the silent failure
  path and wait for it to fire (CloudWatch for the Lambdas).
- "Three different attempted fixes shipped without log evidence" is a red flag.
  Surface it and ask for diagnostic input.
- Do NOT ship a second root-cause fix without diagnostic data from the first failure.
  Stop and instrument instead.

## Contract changes

- Before changing anything with consumers — a Lambda response shape, a shared type, a
  DynamoDB access pattern, an exported helper — grep every caller first and list them.
  Skip the ceremony for small `/fix` work.
- Do NOT bulk find-replace without grepping every consumer first.

## Diagnostic commands

- Queries must be self-contained — no `<placeholder>` for IDs the query can find itself.
- If you need "the most recent X" or "a row matching email Y," write the lookup INTO
  the query.
- If a placeholder is genuinely unavoidable, mark it `# REPLACE: <description>` so the
  user knows what to fill.
