# Git and Issue Discipline

Always loads.

## Commits

- Branch naming: `<type>/<issue-number>-<short-desc>` (e.g. `feature/42-coverage-calc`)
- Commit subject starts with the issue number: `#42 add coverage calculation`
- Do NOT tag an issue number in a commit unless the commit is directly related to
  that issue. A sweep touching five areas is not "#42".
- PRs must use `Closes #N` in the description — the branch name alone does NOT auto-link.
- No `Co-Authored-By` trailer, ever, in any repo. Enforced by `includeCoAuthoredBy: false`
  and the empty `attribution` block in `~/.claude/settings.json` — don't re-add it by hand.
- Never amend a commit unless asked. Never force-push a shared branch.

Base branch is `main` unless the repo's `.claude/CLAUDE.md` Project Config says
otherwise. Read `base_branch` there before opening a PR rather than assuming.

## Issues

- Post a work plan comment before starting implementation.
- Post a completion comment when done — what changed, root cause, anything discovered
  along the way.
- Keep issues around: they are what `Closes #N` links to and what makes `/work-issue`
  resumable.
- File new issues for problems found while debugging — don't let them evaporate when
  the session ends.

## Board — opt-in per repo

XomBoard is **off by default**. A repo opts in by setting `pm_tool: github-projects`
in its `.claude/CLAUDE.md` Project Config. Check that before touching a board; do not
assume a repo is tracked.

Where it is on:

- Update the item's status before closing the issue. Never close without it.
- Set App, Category and Priority when adding an item.
- Move items through: Backlog → Up Next → In Progress → In Review → Done.
