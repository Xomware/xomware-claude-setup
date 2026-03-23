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

### 3. Add to XomBoard
```bash
gh project item-add {github_project_number} --owner {github_project_owner} --url {issue_url}
```

### 4. Set Board Fields
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
- ALWAYS add the issue to XomBoard after creating
- ALWAYS set App, Category, and Priority on the board item
- Auto-detect App from repo name when possible (e.g. xomify-frontend → Xomify)
- Create the branch but do NOT start coding — let the user decide when to begin

$ARGUMENTS
