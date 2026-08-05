# The Goals Pipeline — How To Use It

Practical guide to the workflow added in v1.1.0. For the design reasoning, see
`docs/features/goals-workflow/PLAN.md`. For the goal file structure, see
`project-template/docs/reference/goal-file-format.md`.

---

## The short version

```
/brainstorm  →  /plan  →  /goals  →  /work-issue
```

Or `/cycle` to run all four in one session with the same gates.

**What each does:**

| Command | Produces | Gate after? |
| ------- | -------- | ----------- |
| `/brainstorm` | `docs/features/<topic>/BRAINSTORM.md` — 2-3 options with tradeoffs | yes |
| `/plan` | `docs/features/<topic>/PLAN.md` — status starts `Draft` | yes, you flip to `Ready` |
| `/goals` | `goals/<date>-<slug>.md` + GitHub issues + `GOALS.md` row | yes, before issues are created |
| `/work-issue` | branches, tests, commits, PRs — one per task | no gates between tasks |

---

## Which path: tracked or untracked?

There are two ways to act on a plan. Pick by whether the work should be visible.

| | `/execute` | `/goals` + `/work-issue` |
| --- | --- | --- |
| GitHub | none | issues + XomBoard |
| State | `EXECUTION_LOG.md`, local | goal file, survives compaction |
| Ends at | working tree, you commit | open PRs with green CI |
| Use when | one sitting, an issue would be overhead | tracked, multi-sitting, or losing state would hurt |

**Rule of thumb:** if you'd be annoyed to lose the thread halfway through, use the tracked
path. That's what the goal file is for.

---

## Why the goal file exists

This is the part worth understanding, because everything else follows from it.

Long sessions get compacted. When that happens, whatever was only in the model's head is
gone — which task was next, what the approach was, what went wrong on task 2. The old flow
lost that and you'd re-explain it.

The goal file is written to disk at every transition. A session that starts tomorrow with no
memory reads it and continues. That's the whole point.

**Corollary:** if the goal file and the model's memory disagree, the file wins. It says so in
the skill.

---

## Where state lives

Three tiers, each with one job:

```
.claude/CLAUDE.md          one line: "Active work: @GOALS.md"    never grows
GOALS.md                   index — one row per active goal        bounded
goals/2026-08-05-thing.md  phases, tasks, progress log            grows, fine
goals/ARCHIVE.md           completed goals                        grows, fine
```

**`CLAUDE.md` is never written to per task.** It's loaded every session and capped at 200
lines; a per-task log crosses that in about 17 tasks. If you ever see work-log entries
appearing in `CLAUDE.md`, something regressed.

---

## Walkthrough

### 1. Plan it

```
/plan add coverage calculation to the reports endpoint
```

Writes `docs/features/coverage-calc/PLAN.md` with `Status: Draft`.

**Read it, then change `Status:` to `Ready`.** This is your intentional go-ahead — `/goals`
refuses a Draft plan, deliberately.

### 2. Schedule it

```
/goals coverage-calc
```

It shows you a preview and **stops**:

```
Goal:       Coverage Calculation
Base:       main
Goal file:  goals/2026-08-05-coverage-calc.md

Phases:
  1. Data layer — 2 tasks
  2. API surface — 2 tasks

Issues to create: 1 tracking + 4 tasks
Board:      XomBoard #2 (Xomware)
```

Check the task breakdown. **One task should be one PR** — roughly one focused sitting. If
tasks look too big to finish in one go, or so small you'd get PR spam, say so and it'll
re-slice.

Issues aren't tidily reversible, which is why this gate exists and why `/cycle` keeps it
separate from plan approval.

### 3. Build it

```
/work-issue
```

Resumes the active goal from `GOALS.md`. For each task, with no gates in between:

1. Branch from `base_branch`
2. Write the named tests first — **they must fail for the right reason**
3. Implement the minimum that makes them pass
4. Green the whole suite, update docs, commit
5. Push, open a PR assigned to you, watch CI
6. Mark the task `in review`, move to the next

**It never merges.** Review is yours. Worst case for an unattended run is a stack of PRs you
close — not a broken `main`.

It stops when: the suite won't go green, CI failed three times, the approach no longer matches
the code, or every task is `in review`.

### 4. Review and merge

You get an ordered PR list. Merge in order if any are stacked — `/work-issue` says so
explicitly when it stacks one on another.

`done` on a task means **merged**, so the loop can never set it. That's not an oversight.

---

## Doing it in one session

```
/cycle add coverage calculation to the reports endpoint
```

Same four stages, same three gates, no re-typing between them. It checks context at every
gate and compacts when needed — Stage 3 is the natural checkpoint, since once the goal file
is on disk everything before it is disposable.

`stop here` at the last gate is a perfectly good answer. A goal file with issues is a
complete deliverable; build it later.

---

## Finding code — `/map`

```
/map --check        report stale and unmapped directories, write nothing
/map                refresh everything stale
/map src/app/core   refresh one directory
```

Generates short `README.md` files that say where things are, so agents jump to the right file
instead of reading the repo.

**Maps are pointers, not prose.** `"Auth: src/app/core/auth/ — entry auth.interceptor.ts"`
survives refactors that invalidate `"auth refreshes on 401 and retries once."` That's
deliberate — a *stale* map is worse than no map, because an agent trusts it and skips the
grep it would otherwise have done.

Every map carries a git tree SHA footer, so `--check` detects drift with pure git and no model
calls. Cheap enough to hook. It won't overwrite a hand-written README that has no footer.

---

## Setup a new repo needs

`/goals` reads `## Project Config` from the repo's `.claude/CLAUDE.md`:

```yaml
pm_tool: github-projects
github_project_number: 2
github_project_owner: Xomware
base_branch: main          # required — /goals stops and asks if missing
goals_dir: goals
create_issues: true        # false for repos where an issue per task is overhead
test_commands:
  - npm test
```

`base_branch` has **no default**. Guessing `main` on a repo using `master` was the specific
failure this avoids.

Board writes need `project` scope on your gh token:

```bash
gh auth refresh -h github.com -s project
```

---

## Gotchas

**Board items aren't unique by issue number.** XomBoard spans every Xomware repo, so `#5`
matches an item in each repo that has one. Any lookup must filter on `repository` too —
otherwise `item-edit` silently updates the wrong card. The skills do this; mentioned here
because it's surprising.

**Deploying this repo needs a version bump.** The plugin cache is keyed by version. Merging
to `main` changes nothing until `plugin.json` and `marketplace.json` both increment.

**Editing `plugins/` doesn't affect your running session.** That loads the installed cache.
Use `claude --plugin-dir ./plugins/xomware` to test a working copy.

---

## When not to use this

- **Under 30 minutes, well understood** → `/fix`
- **Approach already decided** → skip `/brainstorm`, start at `/plan`
- **Single file, no risk** → skip the plan too
- **Untracked, one sitting** → `/plan` then `/execute`

The pipeline is for work worth tracking. Using it for a typo fix is worse than not using it.
