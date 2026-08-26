---
name: walkthrough
description: "Guided stop-by-stop tour of a codebase — how the pieces fit, what's non-obvious, what's worth flagging. Writes docs/walkthrough/[slug].md."
disable-model-invocation: true
argument-hint: "[path/subsystem | trace <what happens> | blank for whole repo]"
---

# /walkthrough — a guided tour of this codebase

Walk a developer through code the way a senior dev would: start at the entry point,
follow the flow, stop at each place that matters, and say the thing that would
otherwise take an hour to notice.

Scope: **$ARGUMENTS**

## Modes — dispatch on the first arg

| Invocation | Scope |
|---|---|
| `/walkthrough` | Whole repo, high altitude. Entry points, layers, data flow, the handful of files that actually matter. |
| `/walkthrough <path or subsystem>` | One area, deep. `lib/beacon/ingest`, "the auth flow", `app/api`. |
| `/walkthrough trace "<what happens>"` | Follow one execution path end to end. "a webhook arrives", "user clicks export", "the nightly sync runs". |

If the arg is ambiguous — a bare word that could be a path or a subsystem — resolve it
against the tree first. Don't ask; check.

## What this is not

- **Not `/code-review`.** That judges a diff for correctness and security. This explains
  code that already works.
- **Not `/init`.** That writes CLAUDE.md. This teaches a human.
- **Not `/map`.** That writes per-directory pointer READMEs so agents can locate code.
  This is a guided tour of one subsystem, read once and thrown away.
- **Read-only until Phase 4.** No edits, no fixes, no "while I'm here". Flag it and move on.

---

## Phase 1 — Recon (delegated)

Reading forty files to build the map would burn the context the tour needs. Spawn **one**
`Explore` agent and keep the main session clean.

Give it this brief, with the mode and scope filled in:

> Recon for a codebase walkthrough. Scope: `<mode + scope>`.
>
> Return a **structured map, not prose**. Every claim carries a `file:line` anchor. Do not
> summarize what code "generally does" — name the actual functions and modules.
>
> Collect:
> 1. **Stack** — languages, framework, package manager, from the manifests. Note versions.
> 2. **Entry points** — where execution actually begins. See `references/recon.md` for
>    per-stack recipes.
> 3. **The spine** — the main path from input to persistence/output, in call order.
> 4. **Churn** — `git log --format= --name-only --since=6.months.ago | sort | uniq -c |
>    sort -rn | head -20`. High-churn files are load-bearing files.
> 5. **Mass** — largest source files, excluding generated, vendored, lockfiles, migrations.
> 6. **Seams** — where layers meet: web→domain, domain→persistence, app→external service.
> 7. **Oddity candidates** — dead code, duplicate implementations, TODO/FIXME/HACK with a
>    date, config that's hardcoded, a module nothing imports. Report as candidates with
>    anchors; do not editorialize.
>
> Then propose **6–12 tour stops in flow order**. Each stop: `file:line`, a one-line reason
> it earns a stop, and which stop it hands off to. Order by execution flow, not by directory.

Read `references/recon.md` yourself for the per-stack entry-point recipes and pass the
relevant section along if the stack is one it covers.

## Phase 2 — Map (main session, gated)

Show the proposed stop list before touring anything:

```
Walkthrough: <scope>  —  <stack>, <n> source files

  1. lib/beacon_web/router.ex:12      where every request enters
  2. .../hook_controller.ex:18        the webhook endpoint, no auth on it
  3. lib/beacon/ingest.ex:42          the GenServer everything funnels through
  ...

9 stops. [start] or tell me to reorder, cut, or add.
```

Wait for confirmation. This is the cheap moment to fix the route — after stop 6 it isn't.

If recon found fewer than 4 stops worth making, say so plainly and offer a single
explanation instead of padding a tour to fill a template.

**Once the route is approved, immediately write the skeleton** to
`docs/walkthrough/<slug>.md` — front matter, the spine, and the stop list with anchors.
A tour is a long session and may compact or die partway through. The flags are the part
that can't be reconstructed from the code, so they must land on disk as they happen, not
at the end. Don't announce the file; just write it.

## Phase 3 — Tour (one stop per message)

**Read the file before describing it.** Every stop, every time. A tour built from recon
notes alone will be confidently wrong about something, and the whole value here is trust.

Exact format:

```
Stop 3/9 — lib/beacon/ingest.ex:42

The ingest GenServer. Everything from the webhook lands here before it touches
the database.

  called by → BeaconWeb.HookController:18
  calls     → Normalizer.run/1, then Repo.insert_all

Non-obvious: batches are hardcoded to 500 at line 61, with a "tune later"
comment from 2024. Nothing reads a config value for it.

[next] [dig] [skip] [why] [flag]
```

Rules:

- **One stop per message. Stop and wait.** Never batch stops, never run ahead because the
  next one is short. The pause is the feature.
- **`Non-obvious:` must be earned.** It's the reason this is a tour and not a file listing.
  If nothing is hiding, write `Non-obvious: nothing hiding here — it does what it says.`
  Never invent an insight to fill the slot.
- Keep the body to 2–4 sentences. Depth is what `dig` is for.
- Anchors are `path:line` so they're clickable.

### Verbs

| Verb | Behavior |
|---|---|
| `next` (or blank) | Advance one stop. |
| `dig` | Open the file properly. Walk the important function bodies, the branches, the error paths. Then re-offer the verbs. |
| `skip` | Advance without detail. |
| `why` | History. `git log --follow -p --` on the file, `git blame -L` around the anchor. Answer *why is it shaped like this* — which commit, which PR, what it replaced. |
| `flag [note]` | Record friction, then advance. See below. |
| `back` | Previous stop. |
| `stop` | End the tour early and go straight to Phase 4 with whatever's been covered. |

Treat plain questions as questions — answer them, then re-offer the verbs. The user
shouldn't have to speak in commands.

### Flagging

`flag` is the "things we don't like" channel. It captures the reaction while the context is
fresh, which is the only moment it's cheap to notice and the usual moment it gets lost.

Record: the anchor, what was flagged, and the user's note if they gave one. If the user
flags something without a note, write the observation yourself from what's on screen.

**Append it to the doc's Friction table the moment it's flagged**, then continue. One
line, no ceremony, no confirmation message — the tour shouldn't stutter. If the session
ends abruptly, the flags survive.

### If context runs short mid-tour

Long tours with several `dig`s will get there. At **≥70% used**: append the stops covered
so far to the doc, then `/compact` keeping the doc path, current stop number, the
remaining stop list, and the scope. Re-read the doc after compacting and carry on from
the next stop.

## Phase 4 — Write-up

Complete `docs/walkthrough/<slug>.md` — the skeleton and the Friction table are already
there from Phases 2 and 3. Fill in what only exists in the conversation: the *shape of it*
narrative, the per-stop write-ups including everything `dig` and `why` turned up, and the
open questions. Format in `references/writeup-template.md`.

Slug: repo name for whole-repo, path-derived for a subsystem (`lib/beacon/ingest` →
`beacon-ingest`), kebab of the phrase for a trace (`a webhook arrives` →
`trace-webhook-arrives`).

If a walkthrough from a **previous** tour was already at that path, don't clobber it —
keep the stops that still hold, update anchors that moved, and add a
`## Changed since [date]` section at the top. The diff between tours is information.

Close with the handoff:

```
docs/walkthrough/beacon-ingest.md — 9 stops, 3 flagged.

The spine is webhook → ingest GenServer → normalizer → bulk insert. The ingest
GenServer is the single point everything funnels through, and it has no backpressure.

Flagged:
  1. ingest.ex:61 — batch size hardcoded, "tune later" from 2024
  2. two normalizers, unclear which is live
  3. hook_controller.ex:18 — no auth on the webhook endpoint

Next: /issue bug for #3, /plan for #2, or leave them in the doc.
```

Offer. Don't file anything without being asked.
