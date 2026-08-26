---
paths:
  - "**/CLAUDE.md"
  - "**/CLAUDE.local.md"
  - "**/AGENTS.md"
  - "**/.claude/**"
---

# Claude Config Hygiene

Loads when editing Claude configuration itself.

- Do NOT put project-specific rules in `~/.claude/CLAUDE.md`. Move them to the
  project's `.claude/CLAUDE.md` or `.claude/rules/`.
- Do NOT let a project `CLAUDE.md` exceed 200 lines. Split path-specific content to
  `.claude/rules/` files with `paths:` frontmatter.
- Do NOT restate linter or formatter rules in `CLAUDE.md`. Point at the config file.
- Do NOT put ephemeral state (current focus, branch lists, deploy checklists) in
  `CLAUDE.md`. That belongs in memory files.
- `paths:` on a rule LIMITS when it loads. Use it to scope something that only applies
  to certain files — never expecting it to broaden activation.
- A glob without `**/` only matches the repo root. `*.tsx` does not match
  `src/app/page.tsx`; `**/*.tsx` does. This bit the project-template rules for months.
- Prefer a skill over a `CLAUDE.md` section when the content is a procedure rather than
  a standing fact. A skill body costs nothing until it's invoked; `CLAUDE.md` is in
  context every session.
- **Exception: a standard is not a procedure.** If it must hold on every task without
  anyone asking for it, it goes in a rule, not a skill. The four `*-standards` skills
  all say "ALWAYS use when…" in their descriptions, which is a hope, not a mechanism.
  Each now has a thin path-scoped rule beside it that loads automatically and carries
  the non-negotiables; the skill still holds the full conventions, on demand.

## Where each thing lives

| Kind | Home | Loads |
|---|---|---|
| Standing fact, every session | `~/.claude/CLAUDE.md` | always |
| Standard that must always hold | `~/.claude/rules/<name>.md`, no `paths:` | always |
| Standard for one kind of file | `~/.claude/rules/<name>.md` with `paths:` | on matching files |
| Procedure you invoke | plugin skill | on demand |
| Hard enforcement | hook in `plugins/xomware/hooks/` | on the tool call |

Rules are user- and project-level only. A plugin **cannot** ship `rules/` — that is
why they live in `global/rules/` here and get linked into `~/.claude/rules/` by
`xom-install-claude-setup`, while skills, agents and hooks ride in the plugin.
