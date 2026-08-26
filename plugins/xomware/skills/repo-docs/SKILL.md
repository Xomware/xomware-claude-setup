---
name: repo-docs
description: "Write or refresh this repo's durable reference docs — docs/architecture.md (how it works) and docs/runbook.md (how to deploy, roll back, un-break it), with watches: globs so staleness gets caught."
disable-model-invocation: true
argument-hint: "[both (default) | architecture | runbook] [--refresh]"
---

# /repo-docs — the repo's durable reference

Two docs, written from the code and only from the code:

| Doc | Answers | Reader |
|---|---|---|
| `docs/architecture.md` | What is this, how do the pieces fit, what decisions is it built around | someone about to change it |
| `docs/runbook.md` | How do I run it, ship it, and un-break it | someone on the hook at 6pm |

Scope: **$ARGUMENTS**

## What this is not

- **Not `/init`.** That writes `CLAUDE.md` — the lean, always-loaded file. These two load on
  demand and carry the detail `CLAUDE.md` can't afford. If `CLAUDE.md` is missing, run
  `/init` first; this command assumes it exists.
- **Not `/walkthrough`.** That teaches a human one subsystem, interactively, and is thrown
  away after. This writes a durable repo-level reference nobody sits through.
- **Not `/map`.** That writes per-directory pointer READMEs. This writes the repo-level
  architecture and runbook.

## The one rule that matters

**Every fact comes from a file in this repo, or it is written `**unknown**`.**

Not "probably deploys via GitHub Actions." Not a plausible rollback command. This is not
conservatism — it's the failure mode this command exists to fix. Two real examples, both
found on 2026-08-10:

- A hand-written `docs/architecture.md` described a service module that had been deleted
  two refactors earlier. Every session after that read it and planned against a file that
  did not exist.
- An infra repo's doc listed 3 apps behind CloudFront. There were 7, and the doc omitted
  the one that was actually paging.

Both were well-written. Both got trusted. A confidently wrong doc costs more than a missing
one, and a wrong *runbook* costs the most of all — it gets followed during an incident.

---

## Phase 1 — Dispatch

Run `scripts/audit.sh` (no args, from the repo root) for the state of this repo in one line,
then:

1. Confirm you're at a repo root (`git rev-parse --show-toplevel`). Work from there.
2. Note which targets exist already:
   - Neither → generate both. Fresh write.
   - One or both exist and `--refresh` was **not** passed → say so and stop. Require
     `--refresh` to touch an existing doc. Do not silently overwrite someone's writing.
   - `--refresh` → non-destructive update, see Phase 5.
3. **Check for an instruction file** — `CLAUDE.md`, `.claude/CLAUDE.md`, **or `AGENTS.md`**.
   Any of the three satisfies this; repos with a `.codex/` directory use `AGENTS.md` and are
   not undocumented. If none exists, tell the user to run `/init` first and stop — these docs
   are the tier below it and duplicate it badly without it.
4. **Check the repo is mature enough to describe.** Count real source lines, excluding tests,
   generated code and vendored deps. Under a few hundred, look before writing: a freshly
   scaffolded repo has a `PLAN.md`, not an architecture. Writing one anyway documents an
   intention as though it were a system, and it is wrong the moment real code lands. Say so
   and offer `CLAUDE.md` alone instead.
5. **Check for docs already there under other names** — `README.md`, `CONTRIBUTING.md`,
   `RELEASING.md`, `docs/runbooks/`, `docs/adr/`. If deploy steps already live in
   `docs/runbooks/*.md`, do **not** write a competing `docs/runbook.md`; add `watches:` to
   what exists, or write a runbook that links to them rather than restating them. Two docs
   describing one deploy is how both go stale.
6. If the repo is archived or dormant, say so and ask whether it's worth documenting. A
   polished doc on a dead repo is an active trap: it makes the wrong repo look like the
   right destination.

**Why steps 3–5 exist:** the audit that motivated this command checked only for `CLAUDE.md`
and `docs/architecture.md`, and on that basis called `github-actions` and `Project-Tahoe`
undocumented emergencies. `github-actions` in fact had a 136-line README, a 130-line
CONTRIBUTING, a 122-line RELEASING and 620 lines of runbooks — it just uses `AGENTS.md`.
`Project-Tahoe` had 92 lines of source. Counting filenames is not counting documentation.

## Phase 2 — Recon (delegated)

Reading the repo yourself burns the context the writing needs. Spawn **one** `Explore`
agent per target — at most two, in parallel.

### Architecture recon

Read `~/.claude/skills/walkthrough/references/recon.md` and pass the section matching this
repo's stack. It already has the per-stack entry-point recipes, the churn/mass signals, and
the exclusion list — do not restate them here or in the brief.

Brief the agent:

> Recon for a repo architecture doc. Return a **structured map, not prose**. Every claim
> carries a `file:line` anchor. Name actual modules and functions — never "handles the
> business logic".
>
> 1. **Stack** — from the manifests, with versions and how runtimes are pinned.
> 2. **Boundaries** — the top-level units of the codebase and what each owns. Be
>    exhaustive: `ls` the domain/app directory and account for **every** entry. If there
>    are 30, report 30. An architecture doc that covers a third of the codebase is the
>    exact failure this replaces.
> 3. **The spine** — input to persistence/output, in call order.
> 4. **Seams** — web→domain, domain→persistence, app→external service.
> 5. **Decisions with fingerprints** — a config flag, a `lifecycle` block, a versioned
>    table, a hand-rolled thing where a library was available. What was chosen, and what
>    the code shows it was chosen over.
> 6. **Churn** — the top-20 changed paths over 6 months.
> 7. **Enumerate, don't sample** — for any set the doc will list (executors, workers,
>    domains, modules, app folders): glob the directory and return the **complete** list
>    with a count. If you list N, state that N is all of them.

### Runbook recon

Read `references/ops-recon.md` and pass the relevant parts. Brief:

> Recon for a deploy runbook. Facts only, each with a `file:line` anchor. Anything you
> cannot find in a file, return as `unknown` — do not infer a deploy process from the
> stack, and never invent a rollback command.
>
> Find: local run sequence; runtime pinning; environments and their URLs; CI/CD triggers
> and what each workflow does; container/build config; secret source and injection path;
> scheduled work; health checks; migration and rollback mechanics; anything that does not
> roll back cleanly.

## Phase 3 — Derive `watches:`

The globs are the whole staleness mechanism. Get them wrong and the loop is worthless.

- **From recon, not from a per-stack guess.** Use the spine plus the top churn paths.
- **Narrow.** `lambdas/auth/**` over `lambdas/**`. Too broad → every session flags the doc
  → you learn to ignore it → the loop is dead. Under-flagging is recoverable; noise is not.
- **Architecture watches source. Runbook watches ops** — `.github/workflows/**`,
  `docker-compose*.yml`, `Dockerfile*`, `*.tf`, `requirements*.txt`, `package.json`,
  `.env.example`. A refactor under
  `lib/` should not flag the runbook, and a workflow edit should not flag the architecture.
- Exclude tests, generated code, lockfiles, `priv/static`, `node_modules`, `_build`.
- Set `verified:` to today.

State the globs in Phase 4's outline so they get reviewed. They're the part most likely to
be wrong and the cheapest thing to fix before the doc is written.

## Phase 4 — Outline, gated

Show this before writing anything:

```
/repo-docs — xomify-backend (Python/Lambda/DynamoDB, 24 endpoints, 412 commits since last doc)

  docs/architecture.md   REFRESH — last verified 2026-04-29, 180 changes in lambdas/ since
    watches: lambdas/**, terraform/**
    sections: Overview · 24 endpoints (was 11) · Auth flow · Data model · Decisions · Deps
    corrections: refresh_token rotation is documented backwards · 13 endpoints undocumented

  docs/runbook.md        NEW
    watches: .github/workflows/**, terraform/**, requirements.txt
    sections: Local · Envs · Secrets (SSM /xomify/) · Deploy · Rollback · Scheduled
    unknown: rollback procedure — nothing in the repo documents it

[write] or tell me to change the globs, sections, or scope.
```

Wait for confirmation. Name the `unknown`s here — that's the user's cue to fill in what
only they know, which is the highest-value thing this command surfaces.

## Phase 5 — Write

Templates: `~/.claude/skills/../project-template/docs/{architecture,runbook}.md` in the
`claude-setup` repo. Keep their section order and the frontmatter contract.

Fresh write: fill every section, `**unknown**` where recon came up empty.

`--refresh`: **do not clobber.**
- Keep claims that still hold. Fix anchors that moved.
- Correct what's now wrong, and add `## Changed since <old verified date>` at the top listing
  the corrections. The diff between versions is information — someone trusted the old text.
- Bump `verified:`. Update `watches:` if the code moved.
- Never delete a `Known Limitations` entry because you couldn't confirm it; mark it
  `unverified`.

Then clear this repo's entries from `.claude/memory/stale-docs` if present.

Close with:

```
docs/architecture.md — refreshed. 4 claims corrected, 21 domains added.
docs/runbook.md      — new. 3 sections marked unknown.

Corrected:
  · GateStepExecutor documented but does not exist — removed
  · 9 step executors, not 4

Unknown — needs you:
  · rollback procedure (nothing in-repo documents it)
  · prod URL

watches: set. Next session that changes lambdas/** will flag these.
```

Offer to fill the unknowns. Don't invent them.
