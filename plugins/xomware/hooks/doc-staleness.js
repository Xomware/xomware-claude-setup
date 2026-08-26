#!/usr/bin/env node
/**
 * doc-staleness.js
 * Tells you when code moved out from under a doc that describes it.
 *
 * Two modes, wired to two different events:
 *
 *   record   (SessionEnd)   — intersect this session's changed files against each doc's
 *                             `watches:` globs; append the hits to .claude/memory/stale-docs
 *   surface  (SessionStart) — read stale-docs and return it as additionalContext, so the
 *                             NEXT session opens already knowing which docs drifted
 *
 * Why two events instead of one: SessionEnd can only *record* — the session is over and
 * Claude isn't there to act. SessionStart is where it becomes actionable. Neither half
 * works alone.
 *
 * Why a hook and not the /end-session skill: because `session-end.js:8` already documents
 * what happens when this kind of bookkeeping depends on remembering to type a command —
 * "run /end-session religiously" became a documented gotcha. Enforcement that depends on
 * discipline is not enforcement. This fires whether or not anything is typed.
 *
 * Self-healing: `surface` re-reads each doc's current `verified:` value. If it changed
 * since the entry was recorded, the doc was refreshed and the entry is dropped. Without
 * this the hook would nag forever about a doc you already fixed.
 *
 * Requires Node.js >= 16. Exits 0 silently if unavailable.
 * FAILS OPEN on every error path — a broken hook must never wedge the session.
 * Install: referenced in ~/.claude/settings.json SessionEnd + SessionStart hooks.
 */

const [major] = process.versions.node.split(".").map(Number);
if (major < 16) { process.exit(0); }

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");

const MODE = process.argv[2] === "surface" ? "surface" : "record";

// Docs we look for `watches:` in. Anything else is ignored.
const DOC_CANDIDATES = ["CLAUDE.md", path.join(".claude", "CLAUDE.md")];
const DOC_DIR = "docs";

// Never treat our own bookkeeping as a code change — same exclusion track-changes.js makes.
const MEMORY_SEGMENT = `${path.sep}.claude${path.sep}memory${path.sep}`;

const MAX_PATHS_PER_DOC = 5;
const MAX_DOCS_SURFACED = 6;

// --- glob matching (no deps) ----------------------------------------------

/**
 * Supports the subset that actually appears in `watches:`:
 *   lib/**            → lib/foo/bar.ex
 *   **\/*.tf          → foo.tf AND modules/a/foo.tf
 *   .github/workflows/**
 *   docker-compose*.yml
 *   priv/repo/migrations/**
 * `*` stops at a separator; `**` crosses them.
 */
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?"; // `a/**/b` must also match `a/b`
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

function matchesAny(relPath, globs) {
  for (const g of globs) {
    try {
      if (globToRegExp(g).test(relPath)) return g;
    } catch {
      // a malformed glob shouldn't take the hook down with it
    }
  }
  return null;
}

// --- frontmatter ----------------------------------------------------------

/**
 * Pulls `watches:` (inline `[]` or a `- ` block) and `verified:` out of YAML frontmatter.
 * Deliberately not a YAML parser — this reads two known keys and ignores everything else,
 * including comments, so a hand-edited doc can't break it.
 */
function readDocMeta(absPath) {
  let text;
  try {
    text = fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
  if (!text.startsWith("---")) return null;

  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;

  const lines = text.slice(3, end).split("\n");
  const watches = [];
  let verified = "unknown";
  let inWatches = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, ""); // strip trailing comment
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (inWatches) {
      const item = trimmed.match(/^-\s*(.+)$/);
      if (item) {
        watches.push(item[1].trim().replace(/^["']|["']$/g, ""));
        continue;
      }
      inWatches = false; // any non-list line ends the block
    }

    const kv = trimmed.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rest] = kv;

    if (key === "verified") {
      verified = rest.trim() || "unknown";
    } else if (key === "watches") {
      if (rest.trim().startsWith("[")) {
        const inner = rest.trim().replace(/^\[|\]$/g, "").trim();
        if (inner) {
          for (const p of inner.split(",")) {
            const v = p.trim().replace(/^["']|["']$/g, "");
            if (v) watches.push(v);
          }
        }
      } else if (!rest.trim()) {
        inWatches = true;
      }
    }
  }

  return { watches, verified };
}

function collectDocs(cwd) {
  const found = [];
  const seen = new Set();

  const add = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const meta = readDocMeta(path.join(cwd, rel));
    if (meta && meta.watches.length) found.push({ rel, ...meta });
  };

  for (const c of DOC_CANDIDATES) add(c);

  try {
    for (const f of fs.readdirSync(path.join(cwd, DOC_DIR))) {
      if (f.endsWith(".md")) add(path.join(DOC_DIR, f));
    }
  } catch {
    // no docs/ dir — fine
  }
  return found;
}

// --- changed files --------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The cutoff for "changed since this doc was verified": midnight after the verified date.
 *
 * Deliberately the day *after*, not the day itself. Writing a doc at 18:00 from files last
 * edited at 10:00 the same morning must not flag it — that's a false alarm on freshly
 * written work, and it trains you to ignore the signal. The cost is a change made later on
 * the verification day gets missed. That's the right trade: under-flagging is recoverable,
 * noise is not.
 *
 * Returns null when `verified` isn't a real date (`never`, `unknown`), meaning "no baseline".
 */
function cutoffFor(verified) {
  if (!ISO_DATE.test(verified)) return null;
  const [y, m, d] = verified.split("-").map(Number);
  const t = new Date(y, m - 1, d + 1); // local midnight after the verified day
  return isNaN(t.getTime()) ? null : t;
}

function isoDay(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return []; // not a repo, or git unavailable
  }
}

/**
 * Paths from `dirty-files`, repo-relative, **filtered to files that still exist**.
 *
 * The filter is load-bearing. `dirty-files` is drained by /end-session, and when that isn't
 * run it accumulates for months — the first live run of this hook reported
 * `global/hooks/drift-warn.js`, a file deleted long ago. A signal that names paths which
 * don't exist reads as broken and stops being trusted, so old deletions are dropped here.
 * Recent deletions are still caught, by the git-log pass below, which is time-bounded.
 */
function dirtyFilePaths(cwd) {
  const out = new Set();
  let dirty;
  try {
    dirty = fs.readFileSync(path.join(cwd, ".claude", "memory", "dirty-files"), "utf8");
  } catch {
    return out;
  }
  for (const line of dirty.split("\n")) {
    const p = line.trim();
    if (!p || p.includes(MEMORY_SEGMENT)) continue;
    const rel = path.isAbsolute(p) ? path.relative(cwd, p) : p;
    if (!rel || rel.startsWith("..")) continue; // another repo, or outside the tree
    if (!fs.existsSync(path.join(cwd, rel))) continue;
    out.add(rel.split(path.sep).join("/"));
  }
  return out;
}

/**
 * What changed that this doc hasn't accounted for. Three sources, because each alone has a
 * hole:
 *
 *   1. `git log --since=<verified>` — commits landed after the doc was last confirmed
 *      accurate. This is the semantically correct question, it self-bounds, and it works on
 *      a fresh clone with no session history at all. Includes deletions, which are the most
 *      valuable flag of all: "you removed the thing this doc describes."
 *   2. `git diff` — uncommitted work, which no log will show.
 *   3. `dirty-files` — edits this session, covering the case where nothing is committed yet
 *      and the repo isn't a git repo at all.
 *
 * `verified: never`/`unknown` skips source 1 — an unfilled template stub has no baseline to
 * measure drift from, and scanning all history would flag everything.
 */
function changedFilesFor(cwd, verified, cache) {
  const cutoff = cutoffFor(verified);
  const out = new Set();

  // Working-tree sources are bounded by mtime: a file untouched since the doc was verified
  // cannot have staled it, however long it has been sitting in dirty-files. Without this,
  // a doc written today is flagged immediately by months-old entries — which is exactly
  // what the first live run did.
  for (const p of [...cache.dirty, ...cache.uncommitted]) {
    if (!cutoff) {
      out.add(p);
      continue;
    }
    try {
      if (fs.statSync(path.join(cwd, p)).mtime >= cutoff) out.add(p);
    } catch {
      // gone from the worktree — the git-log pass below decides, since it's time-bounded
    }
  }

  // Committed history after the cutoff. Includes deletions, which are the most valuable
  // flag of all: the doc still describes something that no longer exists.
  if (cutoff) {
    const since = isoDay(cutoff);
    if (!cache.since.has(since)) {
      cache.since.set(since, git(cwd, ["log", `--since=${since}`, "--name-only", "--format="]));
    }
    for (const p of cache.since.get(since)) out.add(p);
  }

  return [...out];
}

function buildCache(cwd) {
  return {
    dirty: dirtyFilePaths(cwd),
    uncommitted: [
      ...git(cwd, ["diff", "--name-only"]),
      ...git(cwd, ["diff", "--cached", "--name-only"]),
    ],
    since: new Map(),
  };
}

// --- stale-docs file -----------------------------------------------------
// TSV: <doc rel path>\t<verified value when recorded>\t<comma-joined changed paths>

function staleFilePath(cwd) {
  return path.join(cwd, ".claude", "memory", "stale-docs");
}

function readStale(cwd) {
  try {
    return fs
      .readFileSync(staleFilePath(cwd), "utf8")
      .split("\n")
      .map((l) => l.split("\t"))
      .filter((p) => p.length >= 3 && p[0])
      .map(([rel, verified, paths]) => ({ rel, verified, paths: paths.split(",").filter(Boolean) }));
  } catch {
    return [];
  }
}

function writeStale(cwd, entries) {
  const file = staleFilePath(cwd);
  try {
    if (!entries.length) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body = entries
      .map((e) => [e.rel, e.verified, e.paths.slice(0, MAX_PATHS_PER_DOC).join(",")].join("\t"))
      .join("\n");
    fs.writeFileSync(file, body + "\n", "utf8");
  } catch {
    // can't write — nothing else to do
  }
}

// --- modes ---------------------------------------------------------------

function record(cwd) {
  const docs = collectDocs(cwd);
  if (!docs.length) return;

  const cache = buildCache(cwd);

  // Merge with what previous sessions recorded — doc X staled last session and doc Y this
  // session should both be listed.
  const merged = new Map(readStale(cwd).map((e) => [e.rel, e]));

  for (const doc of docs) {
    // Each doc gets its own window: what changed since *it* was verified.
    const changed = changedFilesFor(cwd, doc.verified, cache);
    const hits = [];
    for (const f of changed) {
      if (f === doc.rel) continue; // editing the doc doesn't stale the doc
      if (matchesAny(f, doc.watches)) hits.push(f);
    }
    if (!hits.length) continue;

    const prior = merged.get(doc.rel);
    const paths = prior ? [...new Set([...prior.paths, ...hits])] : hits;
    merged.set(doc.rel, { rel: doc.rel, verified: doc.verified, paths });
  }

  writeStale(cwd, [...merged.values()]);
}

function surface(cwd) {
  const entries = readStale(cwd);
  if (!entries.length) return;

  // Self-heal: if the doc's verified: changed since we recorded it, it was refreshed.
  const live = [];
  for (const e of entries) {
    const meta = readDocMeta(path.join(cwd, e.rel));
    if (!meta) continue;                    // doc deleted — drop it
    if (meta.verified !== e.verified) continue; // refreshed — drop it
    live.push(e);
  }

  if (live.length !== entries.length) writeStale(cwd, live);
  if (!live.length) return;

  const shown = live.slice(0, MAX_DOCS_SURFACED);
  const more = live.length - shown.length;

  const lines = shown.map((e) => {
    const p = e.paths.slice(0, MAX_PATHS_PER_DOC).join(", ");
    const extra = e.paths.length > MAX_PATHS_PER_DOC ? `, +${e.paths.length - MAX_PATHS_PER_DOC} more` : "";
    return `- ${e.rel} (verified ${e.verified}) — changed under it: ${p}${extra}`;
  });

  const context = [
    "Stale repo docs — code under these docs' `watches:` globs changed in a previous session",
    "and the doc hasn't been re-verified since:",
    "",
    ...lines,
    more > 0 ? `- …and ${more} more` : "",
    "",
    "Mention this once if the user's task touches the same area. Offer `/repo-docs --refresh`.",
    "Do not refresh unprompted, and do not raise it again this session.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
    })
  );
}

async function main() {
  let input = "";
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) input += line;

  let hookData = {};
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  // `clear` and `resume` continue the work rather than ending it — same reasoning as
  // session-end.js. Recording staleness mid-work would be premature.
  if (MODE === "record" && ["clear", "resume"].includes(hookData.reason)) process.exit(0);

  const cwd = hookData.cwd || process.cwd();
  if (!fs.existsSync(path.join(cwd, ".claude"))) process.exit(0);

  if (MODE === "record") record(cwd);
  else surface(cwd);

  process.exit(0);
}

// Exported when required rather than run, so tests/test-doc-staleness.js can exercise the
// glob and frontmatter layers directly — they're the parts most likely to be subtly wrong.
if (require.main === module) {
  main().catch(() => process.exit(0));
} else {
  module.exports = { globToRegExp, matchesAny, readDocMeta };
}
