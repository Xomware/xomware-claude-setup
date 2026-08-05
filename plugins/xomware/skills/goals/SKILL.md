---
name: goals
description: >
  Turn a Ready plan into a durable goal file plus linked GitHub issues on XomBoard. Writes
  goals/[date]-[slug].md and a GOALS.md index row — never touches CLAUDE.md. Run after
  /plan, before /work-issue. Do not use for tiny tasks — use /fix instead.
argument-hint: "[topic or path to plan file]"
disable-model-invocation: true
allowed-tools: Read Write Edit Glob Grep Bash(gh:*) Bash(git:*) Bash(mkdir:*) Bash(date:*)
---

# /goals

Convert an approved plan into a resumable goal file and a linked set of GitHub issues.
Third step in the pipeline:

`/brainstorm` → `/plan` → **`/goals`** → `/work-issue` → `/end-session`

The goal file is durable state. A session that has been compacted, or one that starts
tomorrow with no memory of today, resumes from it without re-reading the plan or the diff.

**Format spec:** `docs/reference/goal-file-format.md`. Read it before writing anything.
**Reads `## Project Config` from the project's `.claude/CLAUDE.md`.**

## Steps

### 1. Locate the plan

Resolve in this order:

1. `$ARGUMENTS` is a file path → read that file
2. `$ARGUMENTS` is a topic → `docs/features/$ARGUMENTS/PLAN.md`
3. `/plan` output already in this conversation's context
4. Newest file under `docs/features/*/PLAN.md`

If none exists, **stop** and tell the user to run `/plan` first. Do not invent a plan.

**Check the plan's `Status:` header.** If it is `Draft`, stop and say so — a Draft plan is
not ready to become issues. The user flips it to `Ready` first.

Read the plan in full. If it has no explicit phases, derive them from its natural
sequencing — do not pad it with phases the plan does not imply.

### 2. Read Project Config

From `.claude/CLAUDE.md`:

| Key | Used for | If missing |
| --- | --- | --- |
| `base_branch` | Recorded in the goal file header | **Stop and ask.** Never assume `main` |
| `goals_dir` | Where the goal file goes | Default `goals` |
| `create_issues` | Whether to touch GitHub at all | Default `true` |
| `github_project_number` / `github_project_owner` | XomBoard | Skip board step if absent |
| `test_commands` | Quoted into task definitions of done | Note "no tests configured" |

### 3. Break the plan into phases and tasks

Rules from the format spec — these are what make the execution loop safe to leave running:

- Every task finishes in one focused sitting with a green suite at the end
- Every task ends **committable and PR-able**. No task depends on a later task to compile
- One task ≈ one PR. Slicing finer creates PR spam; coarser breaks checkpointing
- At least one **real user scenario test** per task, named concretely against this codebase.
  Read the existing test layout and fixtures before naming anything
- Record `Depends on` between tasks where real ordering exists

### 4. Preview and confirm — GATE

Print, and stop:

```
Goal:       {title}
Objective:  {one line}
Base:       {base_branch}
Goal file:  {goals_dir}/{date}-{slug}.md

Phases:
  1. {name} — {n} tasks
  2. {name} — {n} tasks

Issues to create: 1 tracking + {N} tasks
Board:      XomBoard #{number} ({owner})
```

Wait for a clear yes. Creating issues is not tidily reversible.

If `create_issues: false` or `gh` is unauthenticated, say so here — the goal file is still
worth writing, and this is the moment to say it will have `TBD` issue fields.

### 5. Create the issues

Skip entirely if `create_issues: false` or no remote — go to Step 6 with fields as `TBD`
and a note at the top of the goal file.

Verify first: `gh repo view --json nameWithOwner -q .nameWithOwner`

Create labels if missing: `gh label create goal --force`, `gh label create task --force`

**Use `/github-batch-issues`** for the task issues rather than looping `gh issue create` by
hand — it already handles templating, board add, field setting, and parent-child linking.

One **tracking issue**, labelled `goal`:
- Objective, success criteria, phase list

One issue per task, labelled `task`:
- **Parent:** `#{tracking}`
- **Objective:** what changes and why, two sentences
- **Files touched:** best-guess paths from the plan
- **Test requirements:** the named test cases, including the real user scenario
- **Definition of done:** the task checklist
- **Depends on:** prerequisite issue numbers, or `none`

Then edit the tracking issue body to hold `- [ ] #{n} {title}` lines so GitHub renders
progress automatically.

### 6. Add everything to XomBoard

For each created issue:

```bash
gh project item-add {github_project_number} --owner {github_project_owner} --url {issue_url}
```

> **Board items are not unique by issue number.** XomBoard spans every Xomware repo, so `#5`
> matches an item in each repo that has one. **Always filter on `repository` as well as
> `content.number`** when resolving an item id. This command adds N issues at once, so it
> gets N chances to edit the wrong card — and doing so fails silently.

Set fields with `gh project item-edit`:
- **Status**: `Backlog` — the loop moves it to `In Progress` when work starts
- **App**: auto-detect from repo name (`xomify-frontend` → Xomify, `xomper-ios` → Xomper)
- **Category**: from the task type — bug, feature, cleanup, infra, design
- **Priority**: inherit from the plan, or ask once and apply to all

### 7. Write the goal file

`mkdir -p {goals_dir}` then write `{goals_dir}/{date}-{slug}.md`, exactly to the structure in
`docs/reference/goal-file-format.md`.

- `{date}` from `date +%F`
- `{slug}` kebab-case from `$ARGUMENTS`, else from the plan title
- If the file exists, append `-2`, `-3` — **never overwrite**
- All task statuses start `todo`

### 8. Add the GOALS.md index row

Create `GOALS.md` from the template if absent. Append one row:

```markdown
| {Goal Title} | `{goals_dir}/{file}.md` | #{tracking} | not started | {date} |
```

**Do not write to CLAUDE.md.** It carries one static `Active work: @GOALS.md` pointer and
nothing else. No work log, no goal entry, no status. If that pointer line is missing from the
project's CLAUDE.md, add it once — that is the only edit this command ever makes there.

### 9. Hand off

Print, and nothing more:

```
Goal file:  {path}
Tracking:   {tracking_issue_url}
Tasks:      {N} issues created, added to XomBoard
Index:      GOALS.md updated

Next: /work-issue {first_task_issue_number}
```

## Rules

- Never write implementation code. This produces a plan artifact, issues, and board items.
- Never create issues before the Step 4 confirmation.
- Never overwrite an existing goal file.
- Never touch CLAUDE.md beyond the one-time `@GOALS.md` pointer line.
- Never silently drop plan content. Anything that does not fit a phase/task shape goes under
  **Open questions / deferred** rather than being lost.
- Do not restate issue bodies in the goal file. Issues hold the work; the goal file holds
  sequence and status.
- Never assume `base_branch`. Missing config is a question, not a default.

## Usage

```
/goals coverage-calc              — from docs/features/coverage-calc/PLAN.md
/goals docs/features/x/PLAN.md    — explicit path
/goals                            — most recent plan in context or on disk
```

$ARGUMENTS
