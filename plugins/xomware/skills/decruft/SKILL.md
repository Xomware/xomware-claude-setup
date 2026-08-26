---
name: decruft
description: "Sweep existing code for the shapes rules/code-style.md bans — comments restating the line, padded comment blocks trimmed to the lines that earn their place, no-recovery try/except, one-method classes, single-caller wrappers, dead flags. Reports first, applies only on approval."
disable-model-invocation: true
argument-hint: "[path] [--apply] [--tier comments|dead|structure]"
---

Sweep already-written code against `~/.claude/rules/code-style.md`. Report every
shape found, then apply only what Dominick approves.

Never fires on its own — a sweep is a deliberate operation, and the diff it
produces is pure deletion, which is exactly the diff nobody reads carefully.

## Step 0 — Scope

`$ARGUMENTS` is a path: a file, a directory, or a glob. No path given → ask for
one. Do NOT sweep a whole repo in one pass; that's an unreviewable diff and it
violates `rules/pr-sizing.md`. Suggest the largest subdirectory instead.

Skip: generated files, vendored code, lockfiles, snapshots, migrations, anything
matching `.gitignore`. Say what you skipped and why.

## Step 1 — Find the shapes

Read every file in scope. Record `file:line` for each hit, in three tiers:

**Tier 1 — comments** (pure deletion, no behavior risk)
- Comment restating the line below it
- `// Step 1:` / `# Step 2:` scaffolding narration
- Comment repeating the function name above the function
- Docstring that only lists the argument names and their types
- Docstring longer than the function it documents
- Commented-out code, `# OLD:` blocks
- Banner blocks — `# ===== SETUP =====`, box-drawing dividers, ASCII rules
- Comment explaining what a well-known stdlib or library call does. The reader
  can look up `json.loads`. Explain why *this* call, not what the function is.

**Tier 1b — comment blocks that are mostly padding.** This is the one that gets
missed, because every other rule here deletes a whole comment and this one does
not. Any comment block of more than about six lines gets read line by line:
which of these lines would a competent reader lose something by not having?

Keep those. Delete the rest. **Trim the block, do not spare it.** A block is not
protected because it contains a why — a fifteen-line comment carrying two lines
of real constraint and thirteen of narration is a thirteen-line deletion, not a
comment that stays. Report it as a trim: `keep 2 of 15`.

Same test for a long docstring: the non-obvious contract stays, the restated
signature and the prose padding go.

**Tier 2 — dead** (deletion, verified by tests)
- Log lines narrating control flow ("Starting X", "X complete")
- Parameters no caller passes, config flags nothing flips
- `**kwargs` passthrough nothing uses
- Functions and constants with zero callers — grep to confirm, including tests
  and string references (dynamic dispatch, DI containers, template names)
- Banner prints, emoji output, `print("=" * 60)`

**Tier 3 — structure** (a real refactor, one at a time)
- `try/except` with no recovery action — let it crash
- Class whose methods never touch `self` → module functions
- Class with one method → function
- Config object or dataclass holding fewer than three fields → arguments
- Wrapper called from exactly one place → inline it
- Defensive nesting against hypotheticals the data can't produce
- Indentation past three levels → guard clauses

## Step 2 — Report

Group by tier, not by file. For each hit: `file:line`, the shape, and what the
line does now. No fix text for tier 1 — "delete" is the fix. Tier 1b reports as
`keep N of M` plus the lines you are keeping, since that one is a judgment call
and is the whole point of showing it before applying.

Lead with total lines removed. "14 comment hits" understates a sweep that deletes
180 lines of narration, and understating it is why the big blocks survive.

```
Tier 1 — comments (14 hits, 22 lines)
  src/match.py:22    restates `total = sum(prices)`
  src/match.py:57    "# Step 3:" scaffolding

Tier 1b — padded blocks (3 hits, 41 lines)
  src/load.py:14     keep 2 of 15 — keeping the BOM workaround + issue ref
  src/report.py:88   keep 0 of 11 — narrates the loop below it, no why present
  ...

Tier 3 — structure (2)
  src/load.py:8      try/except returns None, 3 callers each re-check for None
  src/report.py:41   ReportConfig holds 2 fields, 1 construction site
```

Then stop. Give the counts and ask which tiers to apply. `--apply` skips this
gate for tiers 1 and 2 only — never for 1b, whose keep/delete split is a judgment
call that gets seen before it is applied; tier 3 always gets confirmed hit by hit.

## Step 3 — Apply

One commit per tier, never mixed, never alongside a behavior change:

1. Tier 1 — delete. Run the test suite; it must pass unchanged.
1b. Tier 1b — trim each block to the approved lines. Same commit as tier 1.
2. Tier 2 — delete. Run the test suite. A "dead" function whose deletion breaks
   a test was not dead — restore it and say so in the report.
3. Tier 3 — one shape per commit. Behavior must be identical. If a change alters
   behavior even slightly (an exception now propagates where it was swallowed),
   that is a separate decision — surface it, don't bundle it.

Test command comes from the project's `## Project Config` block. No test suite →
say so up front, and treat tier 2 and 3 as report-only. Deleting unverifiable
code is how a sweep breaks production.

## Never delete

- The *lines* that explain the weird thing — a constraint, an upstream bug, a
  measurement, a decision that looks wrong but isn't. Line-level, not
  block-level: a why-carrying line protects itself, never the narration
  surrounding it. Length alone is never the reason to cut, and never the reason
  to keep.
- Anything you cannot prove is unreferenced. Dynamic dispatch, reflection,
  string-keyed registries, and template lookups don't show up in a grep for the
  symbol.
- Error handling with a real recovery path — a retry, a skip-and-count, a
  fallback the user asked for.
- Tests, fixtures the tests use, or public API surface other repos import.

When unsure, list it in the report and leave it. An unswept line costs nothing;
a wrongly deleted one costs an incident.

For tier 1b, "unsure" means *propose the trim and show the keep set* — it does not
mean skip the block. Deciding which lines earn their place is Dominick's call to
make from the report, and silently leaving a padded block out of the report is the
bug this tier exists to fix.

## Output

Counts per tier, the commits made, test status. One or two sentences. No summary
section — see `rules/writing-style.md`.

$ARGUMENTS
