#!/usr/bin/env node
/**
 * session-end.js
 * Fires on SessionEnd — once, when the session actually terminates.
 *
 * One job: drain `.claude/memory/dirty-files`.
 *
 * `track-changes.js` appends every edited path there, and `doc-staleness.js record`
 * reads it on the way out to decide which docs a session staled. Nothing else
 * empties it. Left to grow, every future session inherits every file ever touched
 * and doc-staleness reports the same docs stale forever.
 *
 * The upstream version of this hook also appended a stub to session-log.md when
 * /end-session wasn't run. That is deliberately dropped: Xomware retired
 * /end-session in favour of Claude Code's auto memory, so a session log stub would
 * write to a file nothing reads.
 *
 * Ordering matters — this must run AFTER `doc-staleness.js record` in hooks.json,
 * or it clears the input that hook is about to read.
 *
 * Requires Node.js >= 16. Exits 0 silently on any failure — a broken hook must
 * never wedge the session.
 */

const [major] = process.versions.node.split(".").map(Number);
if (major < 16) { process.exit(0); }

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// `clear` and `resume` continue the work rather than ending it. Draining there
// would lose the change list a still-running session is accumulating.
const SKIP_REASONS = new Set(["clear", "resume"]);

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

  if (SKIP_REASONS.has(hookData.reason)) process.exit(0);

  const cwd = hookData.cwd || process.cwd();
  if (!fs.existsSync(path.join(cwd, ".claude"))) process.exit(0);

  const dirtyFile = path.join(cwd, ".claude", "memory", "dirty-files");
  if (!fs.existsSync(dirtyFile)) process.exit(0);

  fs.writeFileSync(dirtyFile, "", "utf8");
  process.exit(0);
}

main().catch(() => process.exit(0));
