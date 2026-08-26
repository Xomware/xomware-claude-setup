#!/usr/bin/env node
/**
 * compact-carry.js
 * Carries working state across a context compaction.
 *
 *   compact-carry.js save     -> PreCompact:  snapshot branch, changed files and
 *                                             in-flight plan docs to a scratch note
 *   compact-carry.js restore  -> SessionStart(compact): return that note as
 *                                             additionalContext
 *
 * Replaces the old `echo 'Context was compacted...'` SessionStart hook, which told
 * Claude to go re-read things but carried no actual state. Compaction is exactly
 * when "which files was I editing" gets lost, so this hands it back.
 *
 * Requires Node.js >= 16. Exits 0 silently on any problem — never blocks a compact.
 */

const [major] = process.versions.node.split(".").map(Number);
if (major < 16) { process.exit(0); }

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");

const MODE = process.argv[2] === "restore" ? "restore" : "save";

function noteFile(cwd) {
  return path.join(cwd, ".claude", "memory", "compact-carry.md");
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/** Plan docs that are mid-flight, so Claude knows what it was working from. */
function activePlans(cwd) {
  const featuresDir = path.join(cwd, "docs", "features");
  if (!fs.existsSync(featuresDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(featuresDir)) {
    const plan = path.join(featuresDir, entry, "PLAN.md");
    if (!fs.existsSync(plan)) continue;
    try {
      const head = fs.readFileSync(plan, "utf8").slice(0, 600);
      const m = head.match(/\*\*Status\*\*:\s*([^\n]+)/i);
      const status = m ? m[1].trim() : "unknown";
      // Anchor to the leading token. A status of "Draft — flip to `Ready` before
      // /execute" must NOT count as ready just because the word appears in prose.
      if (/^(in[-\s]?progress|ready)\b/i.test(status.replace(/^[`*_]+/, ""))) {
        out.push(`docs/features/${entry}/PLAN.md — ${status}`);
      }
    } catch {
      /* skip unreadable plan */
    }
  }
  return out;
}

async function readHook() {
  let input = "";
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) input += line;
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function save(cwd) {
  if (!fs.existsSync(path.join(cwd, ".claude"))) return;
  const memoryDir = path.join(cwd, ".claude", "memory");
  if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

  const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const upstream = git(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const stat = git(cwd, ["diff", "--stat"]);
  const staged = git(cwd, ["diff", "--cached", "--name-only"]);

  const dirtyFile = path.join(memoryDir, "dirty-files");
  const dirty = fs.existsSync(dirtyFile)
    ? [...new Set(fs.readFileSync(dirtyFile, "utf8").split("\n").filter(Boolean))]
    : [];

  const plans = activePlans(cwd);

  const lines = ["# State carried across compaction", ""];
  if (branch) lines.push(`- Branch: \`${branch}\`${upstream ? ` (tracking \`${upstream}\`)` : " (no upstream)"}`);
  if (plans.length) {
    lines.push("- In-flight plans:");
    plans.forEach((p) => lines.push(`  - ${p}`));
  }
  if (dirty.length) {
    lines.push(`- Files edited this session (${dirty.length}):`);
    dirty.slice(0, 25).forEach((f) => lines.push(`  - ${f}`));
    if (dirty.length > 25) lines.push(`  - …and ${dirty.length - 25} more`);
  }
  if (staged) lines.push(`- Staged: ${staged.split("\n").length} file(s)`);
  if (stat) {
    lines.push("", "```", stat.split("\n").slice(-12).join("\n"), "```");
  }

  fs.writeFileSync(noteFile(cwd), lines.join("\n") + "\n", "utf8");
}

function restore(cwd) {
  const note = noteFile(cwd);
  if (!fs.existsSync(note)) return;
  let body = "";
  try {
    body = fs.readFileSync(note, "utf8").trim();
  } catch {
    return;
  }
  if (!body) return;

  // Consume it — stale state after the next compact would be worse than none.
  try { fs.unlinkSync(note); } catch { /* ignore */ }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          "Context was just compacted. State captured immediately before:\n\n" +
          body +
          "\n\nRe-read the project CLAUDE.md if you need conventions. " +
          "Run /catchup only if the above is not enough to continue.",
      },
    }) + "\n"
  );
}

(async () => {
  const hookData = await readHook();
  const cwd = hookData.cwd || process.cwd();
  if (MODE === "save") save(cwd);
  else restore(cwd);
  process.exit(0);
})().catch(() => process.exit(0));
