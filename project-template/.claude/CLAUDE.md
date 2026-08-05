# [Project Name]

<!-- FIRST SESSION: Run /setup to fill this in interactively, or do it manually.
     Delete this comment block when done. -->

> This file is loaded into every Claude session. Keep it lean and accurate.
> For how the workflow system works, see `docs/reference/`.

Active work: @GOALS.md

<!-- The line above is the ONLY in-flight state that belongs in this file. Never append
     work logs, goal entries, or status here — that lives in GOALS.md and goals/*.md.
     See docs/reference/goal-file-format.md. -->

## What This Is
<!-- What does this project do? Who uses it? One paragraph. -->

## Stack
<!-- List the actual languages, frameworks, and tools. -->

## Key Commands
<!-- What commands does Claude need to build, test, lint, and run this project? -->

## Important Paths
<!-- Which directories and files matter? Only list non-obvious ones.
     The docs/ structure is standard across all projects:
       docs/features/    — one folder per feature (RESEARCH, BRAINSTORM, PLAN, EXECUTION_LOG)
       docs/solutions/   — reusable patterns from /compound
       docs/reference/   — system docs (commands, agents, workflows, file structure)
       GOALS.md          — index of goals in flight (see docs/reference/goal-file-format.md)
       goals/            — one file per goal; ARCHIVE.md indexes completed ones
     Delete these comments and list your project-specific paths. -->

## Project Config
<!-- Integration config for global commands (/work-issue, /board, /backlog).
     Fill in the values relevant to your project. Delete unused sections.
     Run /setup to fill this in interactively. -->
```yaml
pm_tool: github-projects
github_project_number: 2
github_project_owner: Xomware
base_branch: main                        # branch all work starts from
goals_dir: goals                         # where /goals writes goal files
# create_issues: true                    # set false for repos not worth an issue per task
# dev_domain: backend                    # frontend | backend | infra | ios | fullstack (auto-detected if missing)
test_commands:
  - echo "no tests configured"
# build_commands:
#   - npm run build
```

## Constraints
<!-- Project-specific rules and gotchas. Things Claude would get wrong without being told.
     TIP: If a rule only applies to certain directories, move it to
     .claude/rules/[name].md with paths: frontmatter. Keep this file under 200 lines. -->

## Lessons
<!-- Add rules here when Claude makes a mistake worth preventing next time.
     Format: "Do NOT [wrong thing]. Instead, [correct thing]." -->
