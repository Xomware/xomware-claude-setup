# Global Context — Dominick @ Xomware

## Identity
- **Name**: Dominick
- **Role**: Senior Software Engineer
- **Org**: Xomware (personal projects)
- **Mission**: Build and maintain personal software projects under the Xomware brand

## Working Style
- Casual and direct — no fluff, no filler
- Plan before code — always
- Accuracy over speed
- Surface gaps in my thinking, don't just validate me
- Flag repetitive tasks so we can automate them

## What I'm Building
- Personal apps: Xomify (Spotify), Xomper (Sleeper), Xomcloud (SoundCloud), XomFit (fitness), Float (deals), Meals (meal tracking)
- xomware.com — landing page hub with animated mascot and app directory
- Claude Code workflows and tooling for the Xomware org

## Stack
- **Languages**: TypeScript/JavaScript, Python, Swift, HCL
- **Frameworks**: Angular, SwiftUI, FastAPI, Node.js
- **AI**: Anthropic API, Claude Code, MCP servers
- **Infra**: AWS (S3, CloudFront), Terraform, GitHub Actions

## Code Defaults
- TypeScript strict mode
- Functional components, hooks — no class components
- Named exports over default exports (unless framework requires)
- Early returns over nested conditionals
- Explicit error handling — no silent failures
- No commented-out code in commits
- How much code to write, and how much of it should be comments, lives in
  `~/.claude/rules/code-style.md`, which always loads — rules and worked examples
  both. Short version: write the version a competent engineer writes when nobody
  is watching.

## Response Defaults
- Short bullets for lists, prose for explanations
- Always propose a plan before writing code
- Call out assumptions and tradeoffs
- If something seems off, say so
- **All doc output as `.md` files** — never paste long docs into chat, write to file
- Tone and length for chat, GitHub, commits and code comments live in
  `~/.claude/rules/writing-style.md`, which always loads. "No fluff" as a bullet
  here never bound anything — the rule names the specific shapes to delete.

## Standard Workflow

**Quick fix** (bug fix, small change, < 30 min): `/fix [description]`
**Single feature, tracked**: `/research` (optional) → `/brainstorm` → `/plan` → `/goals` → `/work-issue` → `/review`
**Single feature, untracked**: `/brainstorm` → `/plan` → `/execute` → `/review` — no issues, no board
**Single feature, one sitting**: `/cycle [feature]` — the tracked path, same gates, no re-typing
**Epic (multi-feature)**: `/brainstorm` → `/plan [epic]` → `/orchestrate` → `/plan` each stub → `/goals` each → `/work-issue` each
**Understand unfamiliar code**: `/walkthrough [path]` — guided tour, flags friction as you go
**Strip bloat from existing code**: `/decruft [path]` — reports what `code-style.md` bans, applies on approval
**Document a repo**: `/repo-docs` — writes `docs/architecture.md` + `docs/runbook.md` with staleness globs

Full walkthroughs: `@docs/workflows/feature-workflow.md`, `@docs/workflows/epic-workflow.md`, `@docs/workflows/research-workflow.md`

Rules:
- Use `/fix` for small, well-understood changes — it skips brainstorm/plan
- Run `/research` when evaluating unfamiliar tech before brainstorming
- Skip brainstorm only if approach is already decided
- Skip plan only for tiny tasks (single file, no risk, < 30 min)
- Never execute a plan with status `Draft` — flip to `Ready` first
- Use `/compound` to capture patterns worth preserving across sessions
- Run `/catchup` when picking a project back up after time away
- Run `/walkthrough` before working in a repo you don't know — `/research` is for external
  tech, `/walkthrough` is for our own code. It teaches one subsystem and is disposable;
  `/repo-docs` writes the durable repo-level reference
- Never write a doc fact you can't point at a file for — `**unknown**` is the correct
  output. A confidently wrong architecture doc gets trusted; a missing one just gets written

## Pipeline Discipline — No Shortcuts

| Rationalization | Why It's Wrong | Do This Instead |
|----------------|---------------|-----------------|
| "This is a small change" | Small changes cause the most drift | Short spec is fine — still write one |
| "I need more context first" | Exploring without a plan causes drift | Plan first, explore within it |
| "Let me just try something" | Throwaway code becomes production | Spec → Plan → Code. Always. |
| "The tests can come after" | They never do | RED before GREEN |
| "I understand the requirements" | You understand your assumptions | Write them down, confirm |
| "This is obvious, skip docs" | Obvious to you now, opaque to next session | Document it |

## Reference Docs
- `@docs/reference/commands.md` — what each command does and when to use it
- `@docs/reference/agents.md` — what each agent does and how they're invoked
- `@docs/reference/workflows.md` — decision tree for picking the right pipeline
- `@docs/reference/file-structure.md` — where everything lives and why

## Memory
- Auto memory is on and handles session learnings — Claude writes them itself to
  `~/.claude/projects/<repo>/memory/`, and the `MEMORY.md` index loads every session
- Use the `#` shortcut to record something specific mid-session
- Run `/memory` to audit or edit what has been saved
- Git is the source of truth. When a memory contradicts the repo, trust the repo

## Rules loaded separately

`~/.claude/rules/` carries the detail. A rule with no `paths:` frontmatter loads every
session; one with `paths:` loads only when Claude touches a matching file. Standards
that must always hold belong there, never in a skill — a skill that must be invoked is
a skill that never runs. That is why the four `*-standards` skills each have a thin
always-on rule beside them now.

Always load: `code-style.md`, `writing-style.md`, `pr-sizing.md`, `root-cause.md`,
`git-discipline.md`, and `constitution.md` + `constitution-local.md` (Kenn's Clanker
Constitution, vendored verbatim, plus where we differ from it).

Path-scoped: `frontend.md`, `backend.md`, `ios.md`, `infra.md`, `verification.md` (UI
and templates), `config-hygiene.md` (Claude config itself).

Precedence when they disagree: this file and the project's `CLAUDE.md` beat
`constitution.md`. See `constitution-local.md` — in particular its §2 note, where
"Plan before code — always" above wins over the constitution's advice not to impose
planning ceremony. Use `/fix` for the small stuff instead.

Rules cannot ship in a plugin. `xom-install-claude-setup` symlinks them from
`global/rules/` into `~/.claude/rules/`, so editing one here is live next session.

## Lessons
- Do NOT make changes to multiple files without presenting the full plan first.
- Do NOT update `CLAUDE.md` without reading it first and checking the line count after.
- Do NOT create speculative commands, skills, or agents. Build them when the need is confirmed.
- Do NOT duplicate CLAUDE.md content in MEMORY.md. Memory is for non-obvious context; CLAUDE.md is for rules.

Everything else about where config belongs is in `~/.claude/rules/config-hygiene.md`,
which loads whenever Claude config is being edited.
