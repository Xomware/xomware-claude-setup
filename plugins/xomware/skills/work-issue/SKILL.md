---
name: work-issue
description: >
  Full dev cycle for a GitHub issue: load the issue and all its comments, plan the work,
  delegate to the right specialist agents, and close the loop through PR, CI, and board
  update. Runs autonomously task-to-task when the issue belongs to a goal file.
argument-hint: "[issue-number, or goal file path, or blank for the current goal]"
disable-model-invocation: true
allowed-tools: Read Write Edit Glob Grep Bash(gh:*) Bash(git:*)
---

# /work-issue

Full dev cycle orchestrator. Closes the loop from issue to open, green PR.

**You never merge.** Review is the user's job. Your job ends at green CI on an open PR.

**Reads `## Project Config` from the project's `.claude/CLAUDE.md`.** If no config exists,
ask for `base_branch` and `test_commands` — never assume `main`.

## Two modes

Determine the mode in Step 0 and follow the matching path.

| | **Standalone** | **Goal mode** |
| --- | --- | --- |
| Trigger | Issue is not in any goal file | Issue appears in a `goals/*.md` task, or a goal file was passed |
| Scope and approach | Decided here, with the user | Already decided in the goal file |
| Gates | Confirm domain, confirm approach, confirm before push | None between tasks |
| Ends at | Commit, user pushes | PR open, CI green, loops to next task |

Goal mode has no per-task gates because the gates already happened — at `/brainstorm`,
`/plan`, and the `/goals` confirmation. The decisions are recorded in the goal file. Do not
re-ask them.

## Step 0 — Resolve the work

1. If `$ARGUMENTS` is a path to a goal file, or blank and `GOALS.md` lists an active goal →
   **goal mode**.
2. If `$ARGUMENTS` is an issue number, grep `goals/*.md` for `#{number}`. Found → **goal
   mode** for that task. Not found → **standalone**.

In goal mode:
- Read the goal file in full — objective, constraints, progress log, every phase
- Find the **first task with status `todo`**
- Check its `Depends on` issues are closed. If not, work the dependency first
- Print goal title, task ID, task title, issue number, then start. Do not ask permission to
  begin work the user already approved at `/goals`

**If the goal file and your memory disagree, the file wins.**

## Step 1 — Load context

- `gh issue view {number} --json title,body,labels,assignees,comments`
- **Read ALL comments** — look for CI triage bot analysis: type, priority, scope, branch
  name, files involved, recommended approach
- Check XomBoard **only if `pm_tool: github-projects`** — skip when `none` or absent
- Summarize: issue title, type, priority, triage findings, and board status if the board is on

> **Board items are not unique by issue number.** XomBoard spans every Xomware repo, so `#5`
> matches an item in each repo that has one. **Always filter on `repository` as well as
> `content.number`** when locating an item. Editing the wrong card fails silently.

## Step 2 — Branch

Base branch from Project Config. **If it is missing, stop and ask** — never fall back to
`main` silently.

```bash
git remote update --prune
git rev-parse --verify origin/{base_branch}
```

Where to branch from:

- **No open PR from a prerequisite task** → branch from `origin/{base_branch}`
- **A prerequisite task's PR is open and unmerged** → branch from *that* branch and set this
  PR's base to it. This stacks the PRs. **Say so out loud** — the user must merge in order

Use the triage comment's branch name if CI already made one. Otherwise:

```bash
git switch -c {type}/{number}-{short-desc} origin/{base_branch}
```

`{type}` is `feature`, `fix`, `chore`, `docs`, or `refactor`. One branch per task.

Never commit directly to the base branch.

## Step 3 — Board to In Progress — only if `pm_tool: github-projects`

**Skip entirely when `pm_tool` is `none` or absent.** In goal mode still set the task's status
to `in progress` in the goal file — that is the state that matters and it is not board-gated.

When the board is on: update Status to `In Progress` via `gh project item-edit`, adding the
issue first if absent. Resolve the item id by matching **both** `repository` and
`content.number` — see the warning in Step 1. Use the GraphQL `addProjectV2ItemById` mutation
to add, never `gh project item-add`, which exits 0 and silently does nothing.

## Step 4 — Deep analysis

1. **Identify affected files** — grep/glob, read them, understand the current implementation
2. **Map the change surface** — which files, which functions, which endpoints
3. **Check for gotchas** — related tests, migrations, frontend consumers
4. **Estimate scope** — small (1-2 files), medium (3-5), large (5+)

In goal mode, confirm the task's recorded approach still matches reality. Plans go stale. If
the code has diverged enough that the approach is wrong, **stop and say so with a proposed
correction** rather than improvising a different design.

```
## Analysis
**What needs to change:**
- `file.py:function` — reason
**Risks / gotchas:**
- [anything non-obvious]
**Scope:** small / medium / large
```

## Step 5 — Domain classification

**Frontend:** `.tsx`, `.jsx`, `.css`, `.scss`, `components/`, `pages/`, `app/`, UI keywords
**Backend:** `.py`, `.ts` (non-component), `api/`, `services/`, `lib/`, API/database/auth
**Infra:** `.tf`, `.hcl`, `infra/`, `terraform/`, `.github/workflows/`, Dockerfile, CI
**iOS:** `.swift`, `Sources/`, `.xcodeproj`, `.xcworkspace`, SwiftUI/UIKit/Xcode

- `dev_domain` in Project Config is the default
- Files clearly mapping to one domain → classify automatically
- Multiple domains → ask which is primary (**standalone only**; in goal mode take the
  primary from the task's `Files` list)

```
Domain:      [Frontend | Backend | Infra | iOS | Multi: X + Y]
Specialist:  [frontend|backend|infra|ios]-specialist
Standards:   [2-4 most relevant skills]
Context:     [file summary]
```

**Standalone:** confirm with the user. **Goal mode:** proceed.

## Step 6 — Tests first

**Goal mode: mandatory. Standalone: only when the task has a testable surface.**

Write the tests named in the task, including the **real user scenario test**.

- Follow the repo's existing fixtures and layout. Read `tests/` (or `*.spec.ts`,
  `*Tests.swift`) before naming anything
- Real user scenario tests use realistic data and hit the actual entry point. Mock only true
  external boundaries — network, paid APIs, clock
- Run them. **They must fail, and fail for the reason you expect.** A test that passes before
  the implementation exists is testing nothing — fix the test

## Step 7 — Implement

Write the minimum code that makes the tests pass. Follow existing patterns in the file you
are editing over patterns you would prefer. No unrequested refactors, no speculative
abstraction.

**Medium/large scope** delegates to the domain specialist agent:
- Frontend → `frontend-specialist` (frontend-standards, ts-component, api-route, nodejs)
- Backend → `backend-specialist` (backend-standards, python, database, error-handling)
- Infra → `infra-specialist` (infra-standards, terraform, docker-deploy, env-config)
- iOS → `ios-specialist` (ios-standards)

**Small scope** loads the domain standards skill inline and implements in session.

## Step 8 — Green the whole suite

Run every command in `test_commands` from Project Config — the whole suite, not just the new
tests. Run `build_commands` if relevant files changed.

If something unrelated breaks, fix it. A broken suite is not done.

**Never** add `skip` or `xfail`, and never loosen an assertion to reach green. If a
pre-existing failure blocks you, note it in the progress log and say so explicitly.

## Step 9 — Document

1. **Repo docs** — the file named in the task's definition of done. Real content: what
   changed, how to use it, any new config or env var
2. **README** — only if setup, usage, or commands changed
3. **Goal file progress log** — append a row: date, task, issue, PR, commit, and any gotcha
   a future session would want. This is the memory that survives a compact

**Do not append a work log to CLAUDE.md.** It carries one static `Active work: @GOALS.md`
pointer and nothing else.

## Step 10 — Commit

```bash
git add {specific paths}
git commit -m "#{issue} {short description}

{what and why, two or three lines}"
```

- Commit message **starts with the issue number** — `#42 add coverage calculation`
- `Closes #N` goes in the **PR body**, not the commit
- **No `Co-Authored-By` lines. Ever.**
- **Never `git add -A`.** Stage specific paths. Never stage `.env` or credentials
- Do not commit with a red suite

## Step 11 — Push and open the PR

**Standalone mode stops here.** Show the commit and the push command; let the user push.

**Goal mode continues:**

```bash
git push -u origin HEAD
```

**Never force-push.** If the push is rejected, rebase onto the base branch, re-run the suite,
push again.

```bash
gh pr create --base {base_branch} --head {branch} --assignee @me \
  --title "{type}: {task title}" --body-file {tmp}
```

`--base` is the stacked prerequisite branch if Step 2 stacked it. Use `--assignee @me` —
GitHub rejects requesting review from the PR author, so assignment is the mechanism. Not a
draft; it is ready when CI is green.

```markdown
Closes #{issue}
Goal: `goals/{file}.md` — Task {id}

## What changed
{two or three lines}

## Tests
- `{test_name}` — what it asserts
- `{real_user_scenario}` — the user path it exercises

## Review notes
{anything non-obvious, or "none"}
```

Add `> Stacked on #{prev PR}. Merge that one first.` when stacked.

## Step 12 — Watch CI to green

```bash
gh pr checks --watch --fail-fast
```

On failure:

1. Read the **actual** failure — `gh run view {id} --log-failed`. Never guess from the check
   name
2. Fix on the same branch. Run the full suite locally first
3. Commit, push, re-watch
4. **Three attempts maximum.** After the third, stop and report: the failing check, the real
   error, what you tried, what you think is wrong. A CI failure you cannot explain is a
   signal to stop, not to keep pushing commits

**Never** disable a check, add `continue-on-error`, or edit a workflow file to reach green.
If the workflow itself is broken, say so and stop.

No CI configured — note it once and move on.

## Step 13 — Close the loop

- Post a completion comment on the issue: what was done, root cause if a bug fix
- Board → `In Review`, **only if `pm_tool: github-projects`**. **Never set `Done`** — done
  means merged, and you do not merge
- Goal file: task `in progress` → `in review`, record PR number and URL, tick the definition
  of done, append the progress log row
- Last task in a phase → mark the phase complete
- All tasks `in review` → set the goal file header to `awaiting review`, update the `GOALS.md`
  row, and comment the full PR list on the tracking issue. Leave the tracking issue open

## Step 14 — Context checkpoint

**After every task, before starting the next.**

Run `/context`. At **≥70% used**:

1. Confirm Steps 9-13 are fully written to disk — including the pushed branch and open PR.
   The goal file is the handoff; anything only in your head is about to be gone
2. `/compact Keep: goal file path, current phase, next task ID, unresolved gotchas.`
3. Re-read the goal file before continuing

Below 70%: continue.

## Step 15 — Loop or stop

Print three lines: what finished, the PR URL, what is next.

- **Goal mode:** continue automatically to the next `todo` task at Step 2
- **Standalone:** ask whether to pick up another issue, and whether to `/compound` a pattern

**Stop and report** when: the suite cannot go green, CI failed three times, the task's
approach no longer matches the code, a decision needs the user, or every task is `in review`.

When all tasks are `in review`, print the ordered PR list — the user needs merge order,
especially if anything is stacked.

## Rules

- **Never merge a PR.** No `gh pr merge`, no auto-merge, no exceptions
- Never force-push. Never `git add -A`. Never commit to the base branch
- Never mark a task `done` — that is merged, and merging is the user's
- Never edit a test to fit the implementation. Fix the implementation, or say the test was
  wrong and explain why
- Never assume `base_branch`. Missing config is a question, not a default
- One task at a time: one branch, one PR, one commit series
- The goal file is the source of truth
- If the issue is bigger than expected (10+ files, architectural decisions), stop and
  recommend breaking it into sub-issues

## Usage

```
/work-issue 85                    — issue #85; goal mode if it belongs to a goal
/work-issue goals/2026-08-05-x.md — work that goal file start to finish
/work-issue                       — resume the active goal from GOALS.md
```

$ARGUMENTS
