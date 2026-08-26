# Constitution — Xomware Amendments

`constitution.md` is vendored verbatim from Kenn's Clanker Constitution and must stay
that way. Everything Xomware-specific goes here.

Upstream states its own precedence: "Direct user instructions and more specific
repository instructions override these defaults." So the order is:

1. What Dominick says in the session
2. The project's own `CLAUDE.md`
3. `~/.claude/CLAUDE.md` and the other files in `~/.claude/rules/`
4. `constitution.md`

## Where we deliberately differ

**§2 "Do not impose specification, planning, or approval ceremony on straightforward
work"** loses to `CLAUDE.md`'s **"Plan before code — always"**. The ceremony is the
point: `/brainstorm → /plan → /execute` exists so plans get reviewed before code gets
written. The escape hatch is already built in — `/fix` is the no-plan path for small,
well-understood changes, and `CLAUDE.md` says to skip the plan for single-file,
no-risk, sub-30-minute work. Use `/fix`; do not read §2 as licence to skip planning on
a feature.

**§7 "Put durable project guidance in AGENTS.md; have CLAUDE.md import or symlink it"**
— we do the opposite. `CLAUDE.md` is primary across the Xomware repos and
`xom-init-claude-setup` scaffolds it. Where an `AGENTS.md` exists for another agent,
`CLAUDE.md` is the source of truth and `AGENTS.md` is the copy.

**§7 "Do not create agent-private memories instead of updating shared instructions"**
— we run both, deliberately. Claude Code's auto memory at
`~/.claude/projects/<project>/memory/` captures corrections and preferences as they
happen; `.claude/memory/session-log.md` captures session history. Neither replaces
`CLAUDE.md`. The rule we keep from §7 is the one that matters: when a correction is a
standing rule, it goes in `CLAUDE.md` or a rule file, not only in memory.
