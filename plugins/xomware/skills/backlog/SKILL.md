---
name: backlog
description: >
  Create a GitHub issue, add it to XomBoard, set its App/Category/Priority fields, and
  create the working branch.
argument-hint: "[title]"
disable-model-invocation: true
allowed-tools: Bash(gh issue:*) Bash(gh api:*) Bash(git checkout:*) Bash(git branch:*)
---

# /backlog

Create a GitHub issue, add it to XomBoard, set fields, create a branch, and get ready to work.

**Reads project-specific config from `## Project Config` in the project's CLAUDE.md.**

## Steps

### 1. Gather Info
- Accept title as argument, or ask interactively
- Ask for:
  - **Category**: bug, feature, cleanup, infra, design
  - **Priority**: P1-Critical, P2-High, P3-Medium, P4-Low
  - **App**: Xomware, Xomify, Xomper, Xomcloud, XomFit, Meals, Float, Tooling (auto-detect from current repo if possible)
- Ask for optional description (or leave body minimal)

### 2. Create Issue
```bash
gh issue create \
  --title "{title}" \
  --body "## Context\n{description}\n\n## Acceptance\n- [ ] {criteria}" \
  --label "{category}"
```

### 3. Add to XomBoard — only if `pm_tool: github-projects`

**Skip steps 3 and 4 entirely when `pm_tool` is `none` or absent.**

```bash
gh api graphql -f query='
mutation($project:ID!, $content:ID!) {
  addProjectV2ItemById(input:{projectId:$project, contentId:$content}) { item { id } }
}' -f project="{project_node_id}" -f content="{issue_node_id}"
```

> **Do not use `gh project item-add`.** It exits 0 and silently adds nothing on org projects.

### 4. Set Board Fields

> **Board items are not unique by issue number.** XomBoard spans every Xomware repo, so `#5`
> matches an item in each repo that has one. **Always filter on `repository` as well as
> `content.number`** when resolving the item id. Editing the wrong card fails silently.

Use `gh project item-edit` to set:
- **Status**: Backlog (default) or Up Next if urgent
- **App**: from step 1
- **Category**: from step 1
- **Priority**: from step 1

### 5. Create Branch
- Read `base_branch` from Project Config
- Create branch: `git checkout -b {type}/{issue#}-{short-desc} origin/{base_branch}`
- Push: `git push -u origin {branch}`

### 6. Summary
Show:
```
Issue:   #{number} {title}
URL:     {issue_url}
Board:   Added to XomBoard (Backlog, {priority})
Branch:  {branch_name}

Ready to work. Run /work-issue {number} to start.
```

## Usage
```
/backlog "Add dark mode support"     — create with title
/backlog                              — interactive mode
```

## Rules
- Add to XomBoard and set App/Category/Priority ONLY when `pm_tool: github-projects`
- Auto-detect App from repo name when possible (e.g. xomify-frontend → Xomify)
- Create the branch but do NOT start coding — let the user decide when to begin

$ARGUMENTS
