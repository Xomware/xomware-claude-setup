# /pr

Prepare a pull request for current changes.

1. Run `git diff main --stat` to see what changed
2. Run `git log main..HEAD --oneline` to see commits
3. Write a PR description with:
   - **What**: brief summary of changes
   - **Why**: context/motivation
   - **How**: approach taken
   - **Testing**: how to verify it works
4. Suggest a conventional commit-style PR title: `feat:`, `fix:`, `chore:`, etc.
5. Stage and commit if there are unstaged changes (ask first)

$ARGUMENTS
