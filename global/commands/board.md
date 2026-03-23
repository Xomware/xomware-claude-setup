# /board

Fetch the current state of XomBoard. Shows what's active, what's next, and what's blocked.

**Reads `github_project_number` and `github_project_owner` from `## Project Config` in the project's CLAUDE.md.**

## Steps

### If `pm_tool: github-projects` (default)

1. **Query XomBoard**: Use `gh api graphql` to fetch all items from the project board with their Status, App, Category, and Priority fields:
   ```bash
   gh api graphql -f query='
   {
     organization(login: "{github_project_owner}") {
       projectV2(number: {github_project_number}) {
         items(first: 100) {
           nodes {
             fieldValues(first: 10) {
               nodes {
                 ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } }
               }
             }
             content {
               ... on Issue { title number repository { name } state url }
             }
           }
         }
       }
     }
   }'
   ```

2. **Group and display** by Status column in this order: In Progress, In Review, Up Next, Backlog, Done (last 5 only)

   **ALWAYS use this table format for every section:**
   ```
   ### In Progress (N)
   | Issue | App | Priority | Repo |
   |-------|-----|----------|------|
   | **#42 Issue title** | Xomify | P2-High | xomify-frontend |
   ```
   - Every section uses the same table — never switch to bullets or prose
   - Sort by priority within each table (P1 → P2 → P3 → P4)
   - Done: show last 5 only

3. **Summarize**:
   - Tasks per status
   - Highest priority Backlog item
   - Any items without App or Priority set (needs triage)
   - Suggest what to work on next

### If `pm_tool: none` or not set

Show GitHub issues instead:
```
gh issue list --state open --json number,title,labels,assignees
```
Group by labels (bug, enhancement, etc.) and display in table format.

## Usage
```
/board              — full board overview
/board in-progress  — just what's active
/board backlog      — just Backlog items
/board up-next      — just Up Next items
```

## Rules
- Keep output concise — this is a quick status check
- ALWAYS use table format — never bullets for task lists
- Sort by priority within each section
- Flag items missing App or Priority fields

$ARGUMENTS
