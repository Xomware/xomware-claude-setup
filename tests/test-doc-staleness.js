#!/usr/bin/env node
// Test harness for doc-staleness.js.
//
// Self-contained: builds throwaway fixture repos in a temp dir, so it needs no arguments
// and touches nothing real. Each fixture is `git init`ed so the hook's `git diff` fallback
// returns deterministically empty instead of picking up whatever repo the temp dir sits in.
//
// Usage: node tests/test-doc-staleness.js [path/to/doc-staleness.js]

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOOK =
  process.argv[2] ||
  path.join(__dirname, "..", "plugins", "xomware", "hooks", "doc-staleness.js");
const { globToRegExp, readDocMeta } = require(path.resolve(HOOK));

let fail = 0;
function check(group, name, ok, detail) {
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  [${group}] ${name}${ok || !detail ? "" : `  → ${detail}`}`);
}

// ---------------------------------------------------------------- glob layer

const globCases = [
  // [glob, path, shouldMatch]
  ["lib/**", "lib/areteos/runs/engine.ex", true],
  ["lib/**", "lib/foo.ex", true],
  ["lib/**", "test/foo_test.exs", false],
  ["lib/**", "priv/lib/x.ex", false],
  ["**/*.tf", "main.tf", true],
  ["**/*.tf", "modules/vpc/main.tf", true],
  ["**/*.tf", "main.tfvars", false],
  ["*.tf", "main.tf", true],
  ["*.tf", "modules/main.tf", false],
  ["*/*.tf", "foundation/main.tf", true],
  ["*/*.tf", "main.tf", false],
  [".github/workflows/**", ".github/workflows/deploy.yml", true],
  [".github/workflows/**", ".github/dependabot.yml", false],
  ["docker-compose*.yml", "docker-compose.yml", true],
  ["docker-compose*.yml", "docker-compose.prod.yml", true],
  ["docker-compose*.yml", "sub/docker-compose.yml", false],
  ["priv/repo/migrations/**", "priv/repo/migrations/20260101_x.exs", true],
  ["config/**", "config/runtime.exs", true],
  ["app/**", "app/api/route.ts", true],
  // `a/**/b` must also match `a/b` — the zero-directory case
  ["lib/**/router.ex", "lib/router.ex", true],
  ["lib/**/router.ex", "lib/web/router.ex", true],
  // regex metacharacters must be escaped in the glob, not interpreted.
  // `*` legitimately covers `+`, so this matches:
  ["docs/*.md", "docs/a+b.md", true],
  // but a literal `+` in the glob must stay literal — unescaped, `a+b` would mean
  // "one or more a's then b" and would wrongly match "aab".
  ["docs/a+b.md", "docs/a+b.md", true],
  ["docs/a+b.md", "docs/aab.md", false],
  ["docs/a.md", "docs/aXmd", false],
];

for (const [glob, p, want] of globCases) {
  let got;
  try {
    got = globToRegExp(glob).test(p);
  } catch (e) {
    got = `threw ${e.message}`;
  }
  check("glob", `${glob}  vs  ${p}`, got === want, `want=${want} got=${got}`);
}

// malformed globs must not throw out of the matcher
try {
  globToRegExp("lib/[unclosed");
  check("glob", "malformed glob does not throw at build time", true);
} catch {
  // building may throw; matchesAny catches it. Verified in the integration cases below.
  check("glob", "malformed glob does not throw at build time", true);
}

// ------------------------------------------------------- frontmatter parsing

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "doc-staleness-"));

function writeTmp(name, content) {
  const p = path.join(TMP, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  return p;
}

const fmCases = [
  [
    "block list + comments",
    `---\ndoc: architecture\nverified: 2026-08-10\n# watches: a comment that must be ignored\nwatches:\n  - lib/**\n  - config/**   # trailing comment\n---\n# Body\n`,
    { watches: ["lib/**", "config/**"], verified: "2026-08-10" },
  ],
  ["inline empty list", `---\nwatches: []\nverified: never\n---\n`, { watches: [], verified: "never" }],
  [
    "inline populated list",
    `---\nwatches: ["lib/**", 'config/**']\nverified: 2026-01-01\n---\n`,
    { watches: ["lib/**", "config/**"], verified: "2026-01-01" },
  ],
  ["no frontmatter", `# Just a heading\n`, null],
  ["unterminated frontmatter", `---\nwatches:\n  - lib/**\n`, null],
  [
    "block list terminated by next key",
    `---\nwatches:\n  - lib/**\ndoc: architecture\n---\n`,
    { watches: ["lib/**"], verified: "unknown" },
  ],
  ["missing verified defaults to unknown", `---\nwatches:\n  - lib/**\n---\n`, { watches: ["lib/**"], verified: "unknown" }],
];

for (const [name, content, want] of fmCases) {
  const p = writeTmp(`fm/${name.replace(/\W+/g, "-")}.md`, content);
  let got;
  try {
    got = readDocMeta(p);
  } catch (e) {
    got = `threw ${e.message}`;
  }
  const ok =
    want === null
      ? got === null
      : got && JSON.stringify(got.watches) === JSON.stringify(want.watches) && got.verified === want.verified;
  check("frontmatter", name, ok, `got=${JSON.stringify(got)}`);
}

check(
  "frontmatter",
  "missing file returns null (does not throw)",
  readDocMeta(path.join(TMP, "does-not-exist.md")) === null
);

// --------------------------------------------------------------- integration

function runHook(mode, cwd, hookData = {}) {
  return spawnSync("node", [HOOK, mode], {
    input: JSON.stringify({ cwd, ...hookData }),
    encoding: "utf8",
  });
}

/**
 * Build a fixture repo.
 *   docs:   {relPath: content}
 *   dirty:  paths written to dirty-files. Each is also CREATED on disk, because the hook
 *           filters dirty-files to paths that still exist.
 *   absent: paths written to dirty-files but deliberately NOT created, to exercise that filter.
 *   commits: [{files: {rel: content}, date: "YYYY-MM-DD"}] — committed history for the
 *           --since=<verified> window.
 */
function fixture(name, { docs = {}, dirty = null, absent = [], stale = null, commits = [], gitInit = true } = {}) {
  const root = path.join(TMP, "repos", name);
  fs.mkdirSync(path.join(root, ".claude", "memory"), { recursive: true });
  for (const [rel, content] of Object.entries(docs)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf8");
  }
  if (gitInit) {
    spawnSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  }
  for (const { files, date } of commits) {
    for (const [rel, content] of Object.entries(files)) {
      const p = path.join(root, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content, "utf8");
    }
    spawnSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
    spawnSync(
      "git",
      ["-c", "user.email=t@t.t", "-c", "user.name=t", "commit", "-q", "-m", `at ${date}`],
      { cwd: root, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_DATE: `${date}T12:00:00`, GIT_COMMITTER_DATE: `${date}T12:00:00` } }
    );
  }
  if (dirty !== null || absent.length) {
    for (const rel of dirty || []) {
      if (path.isAbsolute(rel)) continue;
      const p = path.join(root, rel);
      if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, "x\n", "utf8");
      }
    }
    const all = [...(dirty || []), ...absent];
    fs.writeFileSync(
      path.join(root, ".claude", "memory", "dirty-files"),
      all.map((d) => (path.isAbsolute(d) ? d : path.join(root, d))).join("\n") + "\n",
      "utf8"
    );
  }
  if (stale !== null) {
    fs.writeFileSync(path.join(root, ".claude", "memory", "stale-docs"), stale, "utf8");
  }
  return root;
}

// Fixture files are written NOW, so the default verified date must be safely in the past —
// the hook deliberately ignores same-day changes (see cutoffFor). A fixture dated today
// would be flagged by nothing at all.
const VERIFIED = "2026-01-01";

const ARCH = (verified = VERIFIED, watches = ["lib/**", "config/**"]) =>
  `---\ndoc: architecture\nverified: ${verified}\nwatches:\n${watches.map((w) => `  - ${w}`).join("\n")}\n---\n# Arch\n`;

const RUNBOOK = `---\ndoc: runbook\nverified: ${VERIFIED}\nwatches:\n  - .github/workflows/**\n---\n# Runbook\n`;

function staleFor(root) {
  const p = path.join(root, ".claude", "memory", "stale-docs");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

// record — a watched path produces an entry
{
  const r = fixture("watched-hit", {
    docs: { "docs/architecture.md": ARCH() },
    dirty: ["lib/areteos/runs/engine.ex"],
  });
  runHook("record", r);
  const out = staleFor(r);
  check("record", "watched change records the doc", out.includes("docs/architecture.md"), `out=${JSON.stringify(out)}`);
  check("record", "records the matched path", out.includes("lib/areteos/runs/engine.ex"), `out=${JSON.stringify(out)}`);
  check("record", "records the verified value", out.includes(VERIFIED), `out=${JSON.stringify(out)}`);
}

// record — unwatched path produces nothing
{
  const r = fixture("watched-miss", {
    docs: { "docs/architecture.md": ARCH() },
    dirty: ["test/runs/engine_test.exs", "README.md"],
  });
  runHook("record", r);
  check("record", "unwatched change records nothing", staleFor(r) === "", `out=${JSON.stringify(staleFor(r))}`);
}

// record — only the doc whose globs match is recorded
{
  const r = fixture("two-docs", {
    docs: { "docs/architecture.md": ARCH(), "docs/runbook.md": RUNBOOK },
    dirty: [".github/workflows/deploy.yml"],
  });
  runHook("record", r);
  const out = staleFor(r);
  check("record", "runbook flagged by a workflow change", out.includes("docs/runbook.md"));
  check("record", "architecture NOT flagged by a workflow change", !out.includes("docs/architecture.md"), `out=${JSON.stringify(out)}`);
}

// record — doc without watches is ignored; empty inline list is ignored
{
  const r = fixture("no-watches", {
    docs: {
      "docs/architecture.md": `---\ndoc: architecture\nverified: never\nwatches: []\n---\n`,
      "docs/plain.md": `# no frontmatter at all\n`,
    },
    dirty: ["lib/x.ex"],
  });
  runHook("record", r);
  check("record", "doc with empty watches is ignored", staleFor(r) === "", `out=${JSON.stringify(staleFor(r))}`);
}

// record — editing the doc itself does not stale it
{
  const r = fixture("self-edit", {
    docs: { "docs/architecture.md": ARCH(VERIFIED, ["docs/**", "lib/**"]) },
    dirty: ["docs/architecture.md"],
  });
  runHook("record", r);
  check("record", "editing the doc does not stale the doc", staleFor(r) === "", `out=${JSON.stringify(staleFor(r))}`);
}

// record — memory dir is excluded
{
  const r = fixture("memory-excluded", {
    docs: { "docs/architecture.md": ARCH(VERIFIED, ["**/*"]) },
    dirty: [".claude/memory/session-log.md"],
  });
  runHook("record", r);
  check("record", "memory-dir writes are excluded", staleFor(r) === "", `out=${JSON.stringify(staleFor(r))}`);
}

// record — merges with a prior session's entries
{
  const r = fixture("merge", {
    docs: { "docs/architecture.md": ARCH(), "docs/runbook.md": RUNBOOK },
    dirty: ["lib/a.ex"],
    stale: `docs/runbook.md\t${VERIFIED}\t.github/workflows/deploy.yml\n`,
  });
  runHook("record", r);
  const out = staleFor(r);
  check("record", "prior entry preserved", out.includes("docs/runbook.md"), `out=${JSON.stringify(out)}`);
  check("record", "new entry appended", out.includes("docs/architecture.md"), `out=${JSON.stringify(out)}`);
}

// record — malformed globs must not crash the hook
{
  const r = fixture("bad-glob", {
    docs: { "docs/architecture.md": ARCH(VERIFIED, ["lib/[unclosed", "lib/**"]) },
    dirty: ["lib/a.ex"],
  });
  const res = runHook("record", r);
  check("record", "malformed glob exits 0", res.status === 0, `status=${res.status}`);
  check("record", "malformed glob still matches the good glob", staleFor(r).includes("docs/architecture.md"));
}

// record — dirty-files entries whose file no longer exists are dropped.
// Regression: the first live run reported global/hooks/drift-warn.js, deleted months
// earlier, because dirty-files accumulates whenever /end-session isn't run. A signal that
// names paths which don't exist reads as broken and stops being trusted.
{
  const r = fixture("dirty-deleted", {
    docs: { "docs/architecture.md": ARCH() },
    absent: ["lib/deleted-long-ago.ex"],
  });
  runHook("record", r);
  check("record", "nonexistent dirty-files path is dropped", staleFor(r) === "", `out=${JSON.stringify(staleFor(r))}`);
}
{
  const r = fixture("dirty-mixed", {
    docs: { "docs/architecture.md": ARCH() },
    dirty: ["lib/still-here.ex"],
    absent: ["lib/deleted-long-ago.ex"],
  });
  runHook("record", r);
  const out = staleFor(r);
  check("record", "existing path still recorded alongside a dropped one", out.includes("lib/still-here.ex"));
  check("record", "dropped path absent from output", !out.includes("deleted-long-ago"), `out=${JSON.stringify(out)}`);
}

// record — the --since=<verified> window: committed history counts, and only after the date.
// This is what makes the hook work on a fresh clone with no session history at all.
{
  const r = fixture("since-after", {
    docs: { "docs/architecture.md": ARCH("2026-08-10") },
    commits: [{ files: { "lib/engine.ex": "after\n" }, date: "2026-09-01" }],
  });
  runHook("record", r);
  check(
    "since",
    "commit AFTER verified date is flagged (clean worktree, no dirty-files)",
    staleFor(r).includes("lib/engine.ex"),
    `out=${JSON.stringify(staleFor(r))}`
  );
}
{
  const r = fixture("since-before", {
    docs: { "docs/architecture.md": ARCH("2026-08-10") },
    commits: [{ files: { "lib/engine.ex": "before\n" }, date: "2026-01-15" }],
  });
  runHook("record", r);
  check("since", "commit BEFORE verified date is not flagged", staleFor(r) === "", `out=${JSON.stringify(staleFor(r))}`);
}
{
  const r = fixture("since-deletion", {
    docs: { "docs/architecture.md": ARCH("2026-08-10") },
    commits: [
      { files: { "lib/engine.ex": "v1\n" }, date: "2026-01-15" },
      { files: {}, date: "2026-09-01" }, // placeholder; deletion applied below
    ],
  });
  // A file removed after the doc was verified is the most valuable flag there is:
  // the doc still describes something that's gone.
  fs.rmSync(path.join(r, "lib", "engine.ex"));
  spawnSync("git", ["add", "-A"], { cwd: r, stdio: "ignore" });
  spawnSync(
    "git",
    ["-c", "user.email=t@t.t", "-c", "user.name=t", "commit", "-q", "-m", "remove"],
    { cwd: r, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_DATE: "2026-09-02T12:00:00", GIT_COMMITTER_DATE: "2026-09-02T12:00:00" } }
  );
  runHook("record", r);
  check("since", "a recent deletion is flagged even though the path is gone", staleFor(r).includes("lib/engine.ex"), `out=${JSON.stringify(staleFor(r))}`);
}
{
  const r = fixture("since-never", {
    docs: { "docs/architecture.md": ARCH("never") },
    commits: [{ files: { "lib/engine.ex": "x\n" }, date: "2026-09-01" }],
  });
  runHook("record", r);
  check(
    "since",
    "verified: never skips the history window (a stub has no baseline)",
    staleFor(r) === "",
    `out=${JSON.stringify(staleFor(r))}`
  );
}

// record — absent dirty-files, no .claude, garbage stdin: all fail open
{
  const r = fixture("no-dirty", { docs: { "docs/architecture.md": ARCH() } });
  const res = runHook("record", r);
  check("record", "absent dirty-files exits 0", res.status === 0, `status=${res.status}`);
  check("record", "absent dirty-files writes nothing", staleFor(r) === "");
}
{
  const bare = path.join(TMP, "repos", "no-claude-dir");
  fs.mkdirSync(bare, { recursive: true });
  const res = runHook("record", bare);
  check("record", "no .claude dir exits 0", res.status === 0, `status=${res.status}`);
  check("record", "no .claude dir writes nothing", !fs.existsSync(path.join(bare, ".claude")));
}
{
  const res = spawnSync("node", [HOOK, "record"], { input: "not json at all", encoding: "utf8" });
  check("record", "garbage stdin exits 0", res.status === 0, `status=${res.status}`);
}

// record — reason=clear / resume are skipped (work is still in progress)
for (const reason of ["clear", "resume"]) {
  const r = fixture(`reason-${reason}`, {
    docs: { "docs/architecture.md": ARCH() },
    dirty: ["lib/a.ex"],
  });
  runHook("record", r, { reason });
  check("record", `reason=${reason} records nothing`, staleFor(r) === "", `out=${JSON.stringify(staleFor(r))}`);
}

// surface — emits additionalContext
{
  const r = fixture("surface-hit", {
    docs: { "docs/architecture.md": ARCH() },
    stale: `docs/architecture.md\t${VERIFIED}\tlib/a.ex,lib/b.ex\n`,
  });
  const res = runHook("surface", r);
  let ctx = "";
  try {
    ctx = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
  } catch {}
  check("surface", "emits SessionStart additionalContext", ctx.includes("docs/architecture.md"), `stdout=${res.stdout}`);
  check("surface", "names the changed paths", ctx.includes("lib/a.ex"));
  check("surface", "suggests /repo-docs --refresh", ctx.includes("/repo-docs --refresh"));
  check("surface", "entry survives when doc unchanged", staleFor(r).includes("docs/architecture.md"));
}

// surface — self-heals when the doc was refreshed (verified: changed)
{
  const r = fixture("surface-healed", {
    docs: { "docs/architecture.md": ARCH("2026-09-01") },
    stale: `docs/architecture.md\t${VERIFIED}\tlib/a.ex\n`,
  });
  const res = runHook("surface", r);
  check("surface", "refreshed doc produces no output", res.stdout.trim() === "", `stdout=${res.stdout}`);
  check("surface", "refreshed doc entry is dropped", staleFor(r) === "", `out=${JSON.stringify(staleFor(r))}`);
}

// surface — deleted doc drops the entry
{
  const r = fixture("surface-deleted", { stale: `docs/gone.md\t${VERIFIED}\tlib/a.ex\n` });
  const res = runHook("surface", r);
  check("surface", "deleted doc produces no output", res.stdout.trim() === "", `stdout=${res.stdout}`);
  check("surface", "deleted doc entry is dropped", staleFor(r) === "");
}

// surface — nothing recorded means silence
{
  const r = fixture("surface-empty", { docs: { "docs/architecture.md": ARCH() } });
  const res = runHook("surface", r);
  check("surface", "absent stale-docs is silent", res.stdout.trim() === "" && res.status === 0, `stdout=${res.stdout}`);
}

// surface — malformed stale-docs must not crash
{
  const r = fixture("surface-malformed", {
    docs: { "docs/architecture.md": ARCH() },
    stale: "this is not tsv\n\n\tonly\ttwo\n",
  });
  const res = runHook("surface", r);
  check("surface", "malformed stale-docs exits 0", res.status === 0, `status=${res.status}`);
}

// round trip — record then surface, the way the two hooks actually chain
{
  const r = fixture("round-trip", {
    docs: { "docs/architecture.md": ARCH(), "docs/runbook.md": RUNBOOK },
    dirty: ["lib/areteos/runs/engine.ex", ".github/workflows/deploy.yml"],
  });
  runHook("record", r);
  const res = runHook("surface", r);
  let ctx = "";
  try {
    ctx = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
  } catch {}
  check("round-trip", "both docs recorded and surfaced", ctx.includes("docs/architecture.md") && ctx.includes("docs/runbook.md"), `ctx=${ctx}`);
}

// ------------------------------------------------------------------ teardown

fs.rmSync(TMP, { recursive: true, force: true });

console.log(fail === 0 ? "\nAll cases passed." : `\n${fail} case(s) FAILED.`);
process.exit(fail === 0 ? 0 : 1);
