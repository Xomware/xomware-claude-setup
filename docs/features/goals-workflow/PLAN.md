# Goals Workflow Integration

**Status:** Ready
**Created:** 2026-08-05
**Owner:** Dominick
**Source:** Jay/Garrett's `ce:` + `gw:` command set, TAG team meeting 2026-08-05

Integrate the `gw:goals` / `gw:goal` / `gw:cycle` command set into the existing Xomware
pipeline without ending up with two overlapping ways to do the same thing.

---

## Objective

Add the one thing the current pipeline genuinely lacks — a **durable, resumable state
artifact** that lets an execution loop run across context compactions without losing the
thread — while folding the incoming commands into the existing skills rather than bolting
them on alongside.

Secondary: establish a **navigable context layer** (the "wiki") so agents can locate code
without reading whole repos.

---

## Current state

All Xomware commands are skills in the `xomware` plugin.

- **Source of truth:** `/Users/dom/Code/xomware-claude-setup/plugins/xomware/skills/`
- **Installed cache:** `~/.claude/plugins/cache/xomware/xomware/1.0.0/skills/` (do not edit)
- `~/.claude/commands/` is empty — there are no file-based slash commands, only skills.

Relevant existing skills:

| Skill | Does | Writes |
| --- | --- | --- |
| `/research` | Investigate before deciding | `docs/features/[t]/RESEARCH.md` |
| `/brainstorm` | Diverge then converge to 2-3 options | `docs/features/[t]/BRAINSTORM.md` |
| `/plan` | Structured plan via planner agent | `docs/features/[t]/PLAN.md` |
| `/execute` | Delegation preview, run the plan | `docs/features/[t]/EXECUTION_LOG.md` |
| `/work-issue` | Issue → branch → board → specialists → review → close | GitHub + XomBoard |
| `/github-batch-issues` | Bulk issue creation with parent/child links | GitHub + XomBoard |
| `/backlog` | Single issue + board fields + branch | GitHub + XomBoard |
| `/status` | Table of every feature's doc state | — |
| `/catchup` | Reconcile memory vs git at session start | — |

Project CLAUDE.md files are healthy — 40 to 88 lines, all well under the 200-line rule.
Each carries a `## Project Config` YAML block with `base_branch`, `test_commands`,
`github_project_number`, `github_project_owner`.

---

## Overlap analysis

This is the core finding. The incoming set is **not four new commands** — it is two
duplicates, one heavy overlap, and one genuine gap.

| Incoming | Existing equivalent | Verdict |
| --- | --- | --- |
| `/ce:brainstorm` | `/brainstorm` | **Duplicate.** Drop it. |
| `/ce:plan` | `/plan` | **Duplicate.** Drop it. |
| `/gw:goals` | `/github-batch-issues` (issues only, no state file) | **Partial gap.** Batch-issues creates the issues; nothing creates the durable goal file. |
| `/gw:goal` | `/work-issue` + `/execute` | **Heavy overlap** with real additions. See below. |
| `/gw:cycle` | — | **New**, but thin — it just reads the other four files in sequence. |

### `/gw:goal` vs `/work-issue`

Both take an issue and work it to completion. Shipping both means two commands with
different git rules operating on the same repos — exactly the drift the pipeline
discipline table warns about.

**What `/work-issue` has that `gw:goal` lacks:**
- XomBoard status transitions (Backlog → In Progress → In Review → Done)
- CI triage comment parsing — reuses the branch CI already made
- Specialist agent delegation (frontend / backend / ios / infra)
- Reads `## Project Config` instead of hardcoding

**What `gw:goal` has that `/work-issue` lacks:**
- Tests written first and required to **fail for the right reason**
- `gh pr checks --watch --fail-fast` with a hard 3-attempt cap
- Context checkpoint at ≥70% with a focused `/compact` instruction
- Stacked-PR handling when a prerequisite task's PR is still open
- Explicit "never merge, never force-push, never `git add -A`"
- "If the goal file and your memory disagree, the file wins"

**Decision: merge the second list into `/work-issue`. Do not ship a parallel command.**

### Conflicts to reconcile before any of this lands

1. **Base branch.** `gw:goal` hardcodes `develop` and refuses to fall back. Xomify-frontend
   uses `master`; most others use `main`. Must read `base_branch` from Project Config.
2. **Test runner.** `gw:goal` hardcodes `pytest`. The estate is Angular, SwiftUI, Terraform,
   and Python. Must read `test_commands` from Project Config.
3. **Commit format.** `gw:goal` puts `Closes #<n>` in the commit message. Xomware convention
   is `#42 add coverage calculation` in the commit and `Closes #N` in the **PR body only**.
   Keep the Xomware convention.
4. **CLAUDE.md writes.** Covered below — this is the one you already flagged.

---

## Decision 1 — Stop writing to CLAUDE.md

`gw:goals` appends an `## Active Goals` entry; `gw:goal` appends a `## Work Log` block per
completed task. Both violate existing rules:

> Do NOT put ephemeral state (current focus, branch lists, deploy checklists) in CLAUDE.md.
> Do NOT let project `CLAUDE.md` exceed 200 lines.

At ~8 lines per work-log entry, a 60-line CLAUDE.md crosses 200 lines after roughly
**17 tasks** — under two features.

**But understand why it was written that way.** CLAUDE.md is auto-loaded every session, so
anything in it survives compaction for free. The replacement has to preserve that property,
or the loop loses its memory.

### Three-tier split

| File | Contains | Growth | Loaded |
| --- | --- | --- | --- |
| `.claude/CLAUDE.md` | Rules, Project Config. **One stable pointer line.** | None | Always |
| `GOALS.md` (repo root) | Bounded index of *active* goals only | Bounded — completed rows move out | Via `@GOALS.md` import |
| `goals/<date>-<slug>.md` | Full phases, tasks, progress log | Unbounded, fine | On demand |

CLAUDE.md gains exactly one line, once:

```markdown
Active work: @GOALS.md
```

`GOALS.md` stays an index, never a log:

```markdown
# Active Goals

| Goal | File | Tracking | Status | Started |
| ---- | ---- | -------- | ------ | ------- |
| Coverage calc | `goals/2026-08-05-coverage-calc.md` | #142 | in review | 2026-08-05 |
```

When a goal completes, its row moves to `goals/ARCHIVE.md`. `GOALS.md` never exceeds the
number of things actually in flight.

**The per-task work log is deleted outright, not relocated.** The goal file already has a
Progress log table with date, task, issue, commit, and notes. The CLAUDE.md work log was
duplicating it. Only the "gotchas for future sessions" field is worth keeping — fold that
into the Progress log's Notes column.

---

## Decision 2 — Naming

**No prefix.** Every other Xomware command is bare — `/plan`, `/execute`, `/work-issue`. A
`ce:` or `dg:` namespace would only record who wrote the file, which belongs in frontmatter,
not in the invocation.

| Was | Becomes | Why |
| --- | --- | --- |
| `/ce:brainstorm` | — | dropped, `/brainstorm` exists |
| `/ce:plan` | — | dropped, `/plan` exists |
| `/gw:goals` | `/goals` | Unchanged meaning — this is the right word |
| `/gw:goal` | folded into `/work-issue` | Not a new command |
| `/gw:cycle` | `/cycle` | Unchanged meaning |

**On the `goal` / `goals` collision:** it disappears on its own. The only reason the pair was
confusing is that two commands one character apart did opposite jobs. Since the singular
`/goal` is folded into `/work-issue`, there is no singular left to collide with. `/goals`
keeps the accurate name — the artifact is a set of goals an agent works through and creates
issues from.

The pipeline reads as a sentence: set goals, then work issues.

---

## Decision 3 — What "more autonomous" actually means

`gw:cycle` has four human gates. Removing them is the wrong lever — brainstorm and plan are
where a wrong call is cheapest to catch and most expensive to miss.

The autonomy that pays is **inside the execution loop**: once a goal file exists, the agent
should work task → tests → PR → next task without re-prompting, and stop only on a real
blocker. That is what `gw:goal` Step 11 already does, and it is the right design.

**Gates stay:** after brainstorm, after plan, before issue creation.
**Gates go:** between tasks within an approved goal file.

Two things make the loop safe to leave running:

1. **Every task ends in a committable, PR'd, green-CI state.** Nothing depends on a later
   task to compile.
2. **The agent never merges.** Work accumulates as reviewable PRs. Worst case for a bad
   autonomous run is a stack of PRs you close — not a broken `main`.

Keep both rules verbatim.

---

## Decision 4 — The context layer ("wiki")

The stated goal: files agents read to find things without reading whole repos.

### The failure mode to design against

A stale map is worse than no map. Without one, an agent greps and finds truth. With a wrong
one, it trusts the map, skips the grep, and confidently edits the wrong file. Auto-generated
prose descriptions rot within weeks of active development.

Kevin's approach works because a human tends the wiki daily. Unattended, it decays.

### What survives

**Pointers rot slower than prose.**

- Rots fast: *"Auth uses a JWT interceptor that refreshes on 401 and retries once."*
- Survives: *"Auth: `src/app/core/auth/` — entry `auth.interceptor.ts`, guard `auth.guard.ts`"*

The second stays true through refactors that invalidate the first. Bias every generated map
toward locations and entry points; reserve prose for invariants that genuinely don't change.

### Structure

Build on `docs/architecture.md`, which already exists in the project template and in several
repos. Don't invent a parallel system.

| Layer | File | Maintained by | Content |
| --- | --- | --- | --- |
| Repo | `docs/architecture.md` | Hand-tended, rare edits | Stack, boundaries, invariants, what must not change |
| Area | `<dir>/README.md` | Generated by `/map` | What lives here, entry points, key exports, links out |
| Task | `goals/*.md` | Generated by `/track` | Current work, updated by the loop |

### Staleness detection

Each generated `README.md` ends with a machine-readable footer:

```markdown
<!-- map-generated: 2026-08-05 sha:a1b2c3d files:14 -->
```

- `/map --check` diffs each directory's current tree hash against the recorded SHA and
  reports drift. Cheap, no LLM calls.
- A `PostToolUse` hook on Write/Edit can flag when an edited directory's map is stale.
- `/map <dir>` regenerates one area; `/map` regenerates everything flagged stale.

**Do not auto-regenerate on every edit.** That burns tokens on churn. Flag drift, regenerate
deliberately.

### Scope control

Only map directories that are (a) more than ~5 files and (b) not obvious from their name.
`src/app/shared/pipes/` needs no map. `src/app/core/` does.

---

## Proposed pipeline

```
/research      →  RESEARCH.md              (optional, unfamiliar tech)
/brainstorm    →  BRAINSTORM.md            GATE
/plan          →  PLAN.md                  GATE
/goals         →  goals/<date>-<slug>.md   GATE (issue creation)
                  + GitHub issues + XomBoard
                  + GOALS.md row
/work-issue N  →  branch → TDD → PR → CI → goal file update → next task
                  (autonomous between tasks)
/end-session   →  session-log.md
```

`/cycle` chains brainstorm → plan → goals → work-issue, honoring all three gates.

`/execute` is retired. It overlaps `/work-issue` and has no issue tracking. Anything not
worth an issue should be using `/fix`.

---

## Implementation phases

### Phase 1 — Foundation (no new commands)

1. Add the three-tier state split to the project template:
   `GOALS.md`, `goals/`, `goals/ARCHIVE.md`, and the `Active work: @GOALS.md` line.
2. Extend the `## Project Config` schema with `goals_dir` and `map_enabled`.
3. Write `docs/reference/goal-file-format.md` — the canonical goal file structure, adapted
   from `gw:goals` Step 4 with the CLAUDE.md writes removed.

### Phase 2 — `/goals`

Port `gw:goals` with these changes:
- Writes `goals/<date>-<slug>.md` + `GOALS.md` row; **never touches CLAUDE.md**
- Reuses `/github-batch-issues` for issue creation rather than reimplementing `gh issue create`
- Reads `github_project_number` / `github_project_owner` from Project Config and adds every
  issue to XomBoard with App / Category / Priority set
- Keeps the confirmation gate before creating anything

### Phase 3 — Upgrade `/work-issue`

Fold in, config-driven throughout:
- Goal-file awareness — find the first `todo` task, honor `Depends on`
- Tests first, must fail for the right reason, no `skip` / `xfail` / loosened assertions
- `gh pr checks --watch --fail-fast`, 3-attempt cap, then stop and report the real error
- Context checkpoint at ≥70% with focused `/compact`, re-read goal file after
- Stacked-PR handling
- Guardrails verbatim: never merge, never force-push, never `git add -A`, never edit a
  workflow to get green
- Task status `todo → in review → done`, where **done means merged**
- Loop to the next task automatically; stop on blocker or all-in-review

### Phase 4 — `/cycle`

Thin orchestrator over the four stages with three gates and the context budget rules from
`gw:cycle`. Build last — it is only as good as the stages under it.

### Phase 5 — `/map`

Generate area READMEs, pointer-biased, with the staleness footer. Add `/map --check`.
Ship after Phases 1-4 have run on at least one real feature.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Two execution commands drift apart | Retire `/execute`, fold everything into `/work-issue` |
| Autonomous loop produces unreviewable PR pile | Never merge; one task = one small PR |
| Generated maps go stale and mislead | Pointer-style content, SHA footer, `--check` |
| Goal files duplicate GitHub issues | Issues hold the work; goal file holds sequence + status. Do not restate issue bodies |
| Hardcoded `develop`/`pytest` breaks non-Python repos | Everything from Project Config, no defaults that silently pick wrong |
| Scope creep across 5 phases | Phases 1-3 are the value. 4 and 5 are optional |

---

## Open questions

**1. Namespace** — RESOLVED 2026-08-05. No prefix. `/goals`, `/cycle`.

**2. Does `/goals` require GitHub?**
Recommendation: no. Always write the goal file; create issues by default but allow
`--no-issues`, and degrade gracefully when `gh` is unauthenticated or there is no remote
(write the file, mark issue fields `TBD`, note it at the top). Some repos —
`xomware-infrastructure`, one-off tooling — aren't worth an issue per task, and a goal file
that only works with GitHub can't be used there at all.

**3. XomBoard vs goal file — who owns status?**
Recommendation: **goal file owns loop state, board owns human-visible state, and flow is
one-directional.** The loop writes the goal file on every transition, and pushes to the
board at exactly two moments: task starts → `In Progress`, PR opens → `In Review`. Nothing
else writes the board automatically. `Done` stays manual, because done means merged and the
loop never merges. One direction means they can't argue.

**4. Does this get shared with the TAG team?** — RESOLVED 2026-08-05. **No.** Xomware
personal use only. No org-level config keys, no multi-tenant board settings. The existing
`## Project Config` schema plus `goals_dir` is sufficient. Scope is these commands only —
unrelated to the Orbit intake system discussed in the same meeting.

**5. `/end-session` interaction.**
Recommendation: yes, `/end-session` prunes completed goals from `GOALS.md` to
`goals/ARCHIVE.md`. It already summarizes and commits learnings; this is the same
housekeeping, and it keeps `GOALS.md` bounded without inventing another command.

---

## Not doing

- Porting `/ce:brainstorm` or `/ce:plan` — direct duplicates
- Shipping `/dg:goal` alongside `/work-issue`
- Auto-regenerating maps on every file edit
- Removing the brainstorm or plan gates
