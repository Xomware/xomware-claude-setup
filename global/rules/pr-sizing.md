# PR Sizing

Always loads. This was a skill until it became clear a skill that must be
invoked is a skill that never runs. The standard is unconditional: every task
past a one-line fix gets decomposed before code is written.

A reviewer approves what they can hold in their head. Past a few hundred lines
of logic, review becomes skimming with a rubber stamp — which is when a subtle
bug ships with three approvals on it.

The job is not "make PRs small." It's **make each PR one idea**, and small
follows.

## Decompose first, always

Before writing code for anything bigger than a trivial fix, produce a numbered
list: what each piece does, roughly how big, what it depends on.

```
1. Add `vendor_aliases` table + migration        ~40 lines    no deps
2. Alias lookup function + tests                 ~80 lines    needs 1
3. Wire lookup into the matching pipeline        ~50 lines    needs 2
4. Backfill script for existing vendors          ~60 lines    needs 1
5. Docs: matching methodology update            ~300 lines    needs 3
```

Then stop and let Dominick confirm the split before writing code. A wrong
decomposition caught in five lines of plan costs nothing; caught after four PRs
it costs a day.

This applies inside `/plan`, `/goals`, `/work-issue`, `/execute` and `/cycle`,
not only when someone asks "how should we split this". `/plan` writes
the list into the plan doc's implementation section; `/goals` turns each piece
into its own issue and PR.

## What makes a good split

**Each piece stands alone.** It merges, tests pass, nothing is broken. If piece 2
leaves the base branch half-using the new lookup, that's a cliffhanger, not a
split. Land new code unused first, flip the caller over next — that also gives a
one-line revert.

**Vertical, not horizontal.** Split by capability, not by layer. "Model + query +
endpoint for one entity" is reviewable. "All models," then "all queries," then
"all endpoints" means nobody can evaluate anything until the last PR.

**Refactor and behavior change never ride together.** The single most common
cause of an unreviewable diff. Move code in one PR with zero logic change, then
change behavior in the next where the diff is five visible lines. Mixed, the real
change hides inside 400 lines of noise.

**Mechanical changes get their own PR.** Renames, formatter runs, import
reordering, dependency bumps, generated code, lockfiles. These are reviewed by
reading the command that produced them, not the diff.

**Split on the seam where you'd want to revert.** If part of this ships badly at
2am, what's the smallest thing you'd want to yank? Cut there.

## Size budgets

Count only hand-written logic. Targets, not gates:

| Kind | Target | Stop and reconsider |
|---|---|---|
| Logic (app, pipeline, transforms) | ≤ 200 lines | > 400 |
| Tests for that logic | no limit, within reason | — |
| Documentation, comments, docstrings | ≤ 1000 lines | > 1500 |
| Generated files, lockfiles, fixtures, snapshots | excluded | — |
| Mechanical (rename, format, bump) | excluded, but its own PR | — |

`guard-bash.js` measures this at `gh pr create` and asks past 400 logic lines. It
is a prompt, not a gate — answer it with which "when not to split" case applies,
or go split the PR.

Docs run long because prose is linear: a reviewer reads 800 words of methodology
faster than 200 lines of branching diff. A docs PR can be big and still be one
topic. Same for tests — a 400-line test file beside an 80-line function is fine,
because tests read as a list of cases, not as control flow.

## When a PR outgrows its plan

You'll be halfway through piece 3 and find it needs a refactor to piece 1.
Normal. Don't push through — that's how a 60-line PR becomes 500. Stop, say what
you found, offer the split:

> Wiring the lookup in needs the matcher to take a resolver argument, which
> touches 6 call sites. That's a separate mechanical PR before this one. Do that
> first, or keep going and hand you one bigger diff?

Stack the dependent PR on the first rather than merging everything into one
branch. Base branch per `git-discipline.md`.

## When not to split

Splitting costs branches, round trips, and chances to leave the base branch
half-migrated. Keep it together when:

- The change genuinely doesn't work in pieces (an atomic rename, a schema change
  and the code that reads it)
- Splitting would ship broken intermediate states
- It's mostly generated or mechanical, so the real diff is already tiny
- The total is small enough that the overhead exceeds the benefit

Say which applies rather than silently shipping something big.

## Issues and PRs

One issue per piece. Title states the outcome, two or three lines of context,
acceptance criteria concrete enough that "done" isn't a judgment call.
Dependencies noted explicitly. No effort estimates, no templated headings nobody
reads. `/goals` turns a plan into issues in this shape and the
`github-batch-issues` skill files them; `/pr` writes What / Why / Test with caps
enforced by `guard-bash.js`. Board fields and status transitions are in
`git-discipline.md`.
