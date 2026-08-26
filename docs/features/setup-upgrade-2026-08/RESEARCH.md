# Setup Upgrade Research — Aug 2026

**Status: shipped 2026-08-26.** Steps 1-5 below are done — see #15/#16 (rules layer,
hooks, three skills) and #17 (pruning the duplicate per-repo rules across 21 repos).
DeepSeek and omp were assessed and deliberately not adopted; the reasoning is in §2 and §4
and is the part worth keeping.

Four questions asked: DeepSeek, knowledge graphs/memory, omp.sh, and porting the
work setup. Answering the fourth first, because it changes the other three.

---

## 0. The finding that reframes everything

**`/Users/dom/Code/claude-setup` is not a personal repo. It is the work repo,
54 commits stale.**

```
origin          https://github.com/DominickGiordano/claude-setup.git
local HEAD      6efc13a  2026-03-25
origin/main     ffb12bf  2026-08-25
divergence      0 local-only commits, 54 behind
merge-base      == local HEAD  → clean fast-forward
```

There is nothing to "pull over." It is the same repo. `git pull` is the entire
migration. The last sync was 2026-03-25; five months of work-setup evolution
land in one command.

**The actual personal setup lives somewhere else:** `Xomware/xomware-claude-setup`,
shipped as a Claude Code *plugin* (`xomware@xomware` v1.2.0, `autoUpdate: true`),
installed and live in this session — every `xomware:*` skill and agent comes from
`~/.claude/plugins/cache/xomware/xomware/1.2.0`.

So "here" is ambiguous and the two targets need different work:

| Target | State | Action |
|---|---|---|
| `~/Code/claude-setup` (work) | 54 commits stale | `git pull` |
| `Xomware/xomware-claude-setup` (personal plugin) | live, v1.2.0 | port selected work-repo advances |

Note `~/.claude/{skills,agents,hooks,commands}` are all **empty**. The personal
setup is delivered 100% by the plugin; the copy-based `install-claude-setup` in
this repo installs nothing that is currently in use.

### Pull safety

Working tree has staged/untracked work predating the drift:

```
A  .claude/CLAUDE.md          (template placeholder, not filled in)
A  .claude/settings.json
A  docs/architecture.md       ← also changed upstream
?? docs/features/workflow-orchestration/   (May 2026, untracked)
```

`docs/architecture.md` is the only real collision. Stash or commit to a branch
before pulling. Untracked dirs survive a fast-forward.

---

## 1. What the work repo actually gained (and is worth porting)

Ranked by value-to-effort for the personal plugin.

### Tier 1 — port these

**`global/rules/` — always-loaded standards layer.** The single biggest
structural idea. 13 files. A rule with no `paths:` frontmatter loads every
session; one with `paths:` loads only on matching files.

The rationale, from `config-hygiene.md`, is the part worth internalizing:

> **A standard is not a procedure.** `caveman-code` and `pr-sizing` were skills
> for months and were never once invoked, so the comment and PR-size standards
> simply did not apply. "Costs nothing until invoked" is the wrong trade when the
> answer is *never invoked*.

The personal setup has exactly this bug. `frontend-standards`, `backend-standards`,
`ios-standards`, `infra-standards`, `testing` are all skills whose descriptions say
"ALWAYS use when…" — which is a prayer, not a mechanism.

The fix is two-layer, not a demotion: work keeps the `*-standards` skills and adds a
~20-line **path-scoped** rule beside each one (`rules/frontend.md` etc.) that loads
automatically on matching files, carries the six or eight non-negotiables, and points at
the skill for the rest. Xomware already had these rules — but only in
`project-template/.claude/rules/`, copied per project, and with globs like `"*.tsx"`
that match only the repo root and so never fired on `src/`.

Contents worth taking wholesale: `code-style.md` (the best file in either repo —
"write the version a competent engineer writes when nobody is watching", with four
worked before/after examples), `writing-style.md`, `pr-sizing.md`, `root-cause.md`,
`git-discipline.md`, `verification.md`, `config-hygiene.md`.

**`constitution.md`** — Kenn's Clanker Constitution vendored verbatim from
`kenn-io/constitution`, with local deltas kept in a separate `constitution-local.md`
so the upstream diff stays readable. Good pattern regardless of the content.

**Three new hooks:**
- `guard-comments.js` — PreToolUse on Edit|Write, blocks a one-line comment whose
  words all appear in the line below. Mechanical enforcement of the half of
  `code-style.md` that *can* be mechanized.
- `compact-carry.js` — PreCompact saves state, SessionStart(compact) restores it.
  Directly addresses context loss across compaction. The personal repo's answer to
  the same problem is an `echo` telling Claude to re-read CLAUDE.md.
- `doc-staleness.js` — SessionEnd records which docs went stale, SessionStart
  surfaces them.

**`tests/`** — actual unit tests for the hooks (`test-guard-bash.js`,
`test-guard-comments.js`, `test-doc-staleness.js`). Personal repo has zero tests
for hook logic that can hard-block tool calls.

### Tier 2 — worth it

- **Settings**: `opus[1m]` (1M context), `alwaysThinkingEnabled`, `outputStyle: Concise`,
  `includeCoAuthoredBy: false` + empty `attribution` — the last one enforces the
  no-Co-Authored-By rule at the harness level instead of asking nicely in CLAUDE.md.
- **Symlink-based install** — one copy on disk, repo and `~/.claude` cannot drift,
  edits are live mid-session. CLAUDE.md and settings.json stay copies on purpose
  (Claude Code writes to them). Less relevant for the plugin path, which already
  solves distribution.
- **New skills**: `decruft` (sweep existing code against code-style), `walkthrough`
  (guided tour of unfamiliar code), `repo-docs` (durable per-repo architecture +
  runbook with hook-enforced staleness), `pre-impl-audit`, `end-session`,
  `sync-memory`, `goals`/`goal`/`cycle` (ported from Garrett's workflow).
- **Skill `references/` + `scripts/` subdirs** — progressive disclosure; SKILL.md
  stays short, detail loads on demand. Personal plugin already does this for
  `github-batch-issues` and `xomboard-cli` but not for the big ones (`python`,
  `docker-deploy`, `terraform`).

### Tier 3 — leave

`arete-*` skills, `ash`/`jido`/`phoenix`/`elixir`, `microsoft-graph`, `infisical`.
Work-specific.

---

## 2. DeepSeek

**Verdict: no for the coding loop. Maybe for offline batch.**

Current models are `deepseek-v4-flash` and `deepseek-v4-pro`. Pricing repriced
2026-08-16 with peak/off-peak billing; Flash runs $0.22/$0.66 per 1M cache-miss
in/out off-peak, Pro $0.66/$1.98, doubling at peak (01:00–04:00 and 06:00–10:00 UTC).
Cheap — roughly an order of magnitude under frontier pricing.

**It can technically drive Claude Code.** Claude Code reads `ANTHROPIC_BASE_URL`
at startup, so any endpoint speaking the Anthropic Messages API format can be
swapped in. DeepSeek is one of the models commonly pointed at this way.

**Why it is still a bad trade here:**

- Those requests bill to DeepSeek, not the Claude subscription — you are paying
  twice and losing the plan you already have. (Anthropic cut third-party tool
  access from Claude subscriptions on 2026-04-04; direct CLI config with a
  third-party endpoint still works, but it is a separate bill.)
- `ANTHROPIC_BASE_URL` is process-wide. It is not per-subagent, so "cheap model
  for subagents" is not what this buys. `subagentModel` already exists for that
  and is set to `sonnet` in the personal settings.
- Every hook, skill and rule in both repos is tuned against Claude's behavior.
  Swapping the model underneath invalidates the calibration.
- Data goes to a third party. Fine for OSS; think about it for anything else.

**Where it would actually pay:** a high-volume, low-stakes offline job with no
correctness bar — e.g. bulk-extracting entities from ~750KB of `history.jsonl`
to seed a knowledge graph (see below). That is a script calling the DeepSeek API
directly, not a Claude Code configuration change. Worth doing only if the graph
idea survives.

---

## 3. Knowledge graphs and memory

**Verdict: the graph is the wrong problem. Fix the plumbing first.**

Current memory in the personal setup is four disconnected stores:

| Store | Where | Written by |
|---|---|---|
| Global rules | `~/.claude/CLAUDE.md` | hand |
| Auto-memory | `~/.claude/projects/*/memory/*.md` + `MEMORY.md` index | Claude |
| Session log | `<project>/.claude/memory/session-log.md` | `/end-session` |
| Dirty files | `.claude/memory/dirty-files` | `track-changes.js` |

Nothing reads across them. `MEMORY.md` in this project holds two entries. That is
not a retrieval problem a graph database solves — it is a *capture* problem.

The options, if you did want a graph:
- **Knowledge Graph Memory** (`modelcontextprotocol/servers`) — official reference
  impl, local JSONL, most conservative pick.
- **MemoryGraph** (`memory-graph/memory-graph`) — graph DB, built for coding agents.
- **mcp-memory-service** (`doobidoo`) — REST + graph + autonomous consolidation.
- **codebase-memory-mcp** (`DeusData`) — indexes a *codebase* into a graph, 158
  languages. Different problem: code intelligence, not session memory. This one is
  the most plausibly useful of the four, and overlaps with what LSP already gives you.

All MIT, all local, all free.

**The honest recommendation:** the work repo already solved the memory problem
without a graph, and its answer is better ROI:

- `compact-carry.js` — the real memory leak is compaction, not cross-session recall
- `doc-staleness.js` — closes the write→surface loop automatically
- `repo-docs` — durable per-repo docs with a "never write a fact you can't point at
  a file for; `**unknown**` is the correct output" rule
- `sync-memory` — reconciles the stores

Do those first. If after a month you can name three specific things you wanted
recalled and weren't, add Knowledge Graph Memory then — with a real query pattern
instead of a hope. A graph nobody queries is a slower `grep`.

---

## 4. omp.sh (oh-my-pi)

**Verdict: not an upgrade path. Steal two ideas, skip the tool.**

`omp` is a terminal coding agent — a fork of Mario Zechner's Pi, maintained by
Can Bölük, ~27k lines of Rust + TypeScript, MIT, ~5.5k stars. It is a *competitor
to* Claude Code, not an addition to it. "Upgrading our setup with omp" means
replacing the thing all 40+ skills, 13 agents and 7 hooks are built on.

What it genuinely does better:
- **Hash-anchored edits** — content hashes as anchors instead of string matching.
  Claimed 61% fewer output tokens on the same work by killing retry loops.
- **DAP debugging** — attaches lldb/dlv/debugpy. Claude Code has no debugger.
- **LSP integration** exposed to the agent (diagnostics, references, workspace-wide
  renames).
- **40+ providers with per-role routing and fallback chains** — this is where
  DeepSeek would slot in naturally, and it is per-role rather than process-wide.
- **Subagent orchestration** in isolated filesystem clones (APFS/btrfs/overlayfs).
- **Hindsight** — persistent session memory.

Reality check on the comparison table circulating for it: it lists Claude Code as
having "no fan-out" and "no LSP." Both are stale — Claude Code has subagents,
workflow orchestration, and an `LSP` tool. Discount accordingly.

**Bridges exist** (`omp-claude-bridge`, several forks) that run Claude Code as a
provider *inside* omp via the Agent SDK, with omp's tools bridged in as MCP tools,
plus an `AskClaude` tool for delegating from other providers. That is the only
sane way to try it — it does not require abandoning anything.

**What to steal without adopting it:**
1. **Per-role model routing with fallback chains.** The idea that a provider hitting
   quota should not kill the session. Partially available today via `subagentModel`.
2. **Hindsight-style session memory** — reinforces §3, and `compact-carry.js` is
   already the same instinct.

**What to actually do:** nothing, unless the DAP gap bites. If Swift/Python
debugging is a recurring pain, spend an afternoon on omp via the bridge in a
throwaway repo. Do not migrate.

---

## Recommendation

Ordered, smallest-first.

1. **Sync this repo.** Branch the staged work, `git pull`. Zero risk, five months
   of gains. *(minutes)*
2. **Port `global/rules/`.** Not to the plugin — a plugin cannot ship rules; they load
   from `.claude/rules/` and `~/.claude/rules/` only. They go in `global/rules/` and
   get symlinked by the installer, exactly as work does it.
   The four `*-standards` skills are **not** deleted: each gets a thin path-scoped rule
   beside it carrying the non-negotiables, and the skill keeps the full conventions for
   on-demand loading. *(the big win)*
3. **Port the three hooks** + their tests: `guard-comments`, `compact-carry`,
   `doc-staleness`. *(highest ROI per line)*
4. **Adopt the settings deltas** — `opus[1m]`, `alwaysThinkingEnabled`,
   `outputStyle: Concise`, `includeCoAuthoredBy: false`, empty `attribution`.
5. **Port `decruft`, `walkthrough`, `repo-docs`.** Genuinely new capability.
6. **Then reassess memory.** After (3) lands, decide whether a graph is still wanted.
7. **DeepSeek and omp: no action.** Revisit DeepSeek only for an offline batch job;
   revisit omp only if debugger absence becomes a real cost.

Open question worth settling before step 2: should the two repos converge? They
have drifted into near-duplicates with different distribution mechanisms (symlink
install vs. plugin marketplace) and different org identities. A shared core with
two thin org overlays — the `examples/org-*.md` pattern both already have — is the
obvious shape, and `/set-org` already exists here.
