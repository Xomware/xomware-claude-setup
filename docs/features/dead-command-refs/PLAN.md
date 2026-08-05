# Remove references to the retired /end-session command

**Status:** Ready
**Created:** 2026-08-05
**Owner:** Dominick

The goals pipeline docs reference `/end-session` as the owner of goal archiving. That command
was retired when auto memory replaced the `session-log.md` pipeline. Eight references now
point at a command that does not exist, and the archiving job has no owner.

## Approach

Give archiving a real owner rather than inventing a command for it. `/status` already reads
`GOALS.md`; `/goals` already writes it. Between them the job is covered without adding a
speculative command.

- `/status` reports goals whose PRs are all merged as archivable
- `/goals` prunes those rows to `goals/ARCHIVE.md` at the start of its next run

## Affected files

| File | Change |
| --- | --- |
| `project-template/GOALS.md` | Drop `/end-session`; name `/goals` as the pruner |
| `project-template/goals/ARCHIVE.md` | Same |
| `project-template/docs/reference/goal-file-format.md` | Two refs — the header line and the `done` status row |
| `project-template/docs/reference/file-structure.md` | Tree annotation |
| `plugins/xomware/skills/goals/SKILL.md` | Pipeline line, plus a prune step |
| `plugins/xomware/skills/status/SKILL.md` | Report archivable goals |

## Phases

### Phase 1 — Correct the references

Replace every `/end-session` mention with the real owner. No behaviour change, docs only.

### Phase 2 — Give archiving an owner

Add the prune step to `/goals` and the archivable report to `/status`.

## Tests

No test framework in this repo. Verification is:

- `grep -rn "end-session" --include='*.md' .` returns nothing outside `docs/features/`
- `claude plugin validate ./plugins/xomware` passes
- `claude plugin validate .` passes

## Risks

- Low. Documentation and skill-instruction changes only, no application code.
- `/goals` pruning on its next run means a completed goal lingers in `GOALS.md` until the
  next feature starts. Acceptable — the alternative is a command that exists only to prune.

## Out of scope

- Reviving `/end-session` in any form
- Changing how auto memory works
