#!/usr/bin/env node
/**
 * guard-bash.js
 * Fires on PreToolUse for Bash. Three jobs:
 *
 *   1. Block the handful of catastrophic commands that `permissions.deny` doesn't
 *      already cover. The `rm -rf` family is deliberately NOT here — settings.json
 *      denies `Bash(rm -rf *)` outright, so duplicating it would be two things to
 *      maintain for one outcome.
 *
 *   2. Enforce the prose caps in rules/writing-style.md on anything headed for
 *      GitHub, and on commit messages. "Be concise" sat in CLAUDE.md for months
 *      while PR bodies shipped 320-character single-clause-per-dash bullets.
 *      Prose asks; a hook enforces. The checks are deliberately narrow — length
 *      and a short list of unambiguous filler openers — because a guard that
 *      misfires gets disabled.
 *
 *   3. Ask before a `gh pr create` whose hand-written logic diff blows past the
 *      budget in rules/pr-sizing.md. Asks rather than blocks: some changes
 *      genuinely don't split.
 *
 * There is deliberately no branch-flow rule here. Xomware repos are main-based;
 * a repo that wants a different PR target sets `base_branch` in its
 * .claude/CLAUDE.md Project Config, and /pr reads it.
 *
 * Exit 0 = allow. Exit 2 = block. JSON on stdout can also return "ask" so an
 * ambiguous case becomes a human decision instead of a guess.
 *
 * Requires Node.js >= 16. Fails open (allow) on any internal error — a broken
 * guard must never wedge the session.
 */

const [major] = process.versions.node.split(".").map(Number);
if (major < 16) {
  process.stderr.write("[guard-bash] Node >= 16 required. Hook disabled.\n");
  process.exit(0);
}

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// Catastrophic and NOT covered by permissions.deny.
const BLOCKED_PATTERNS = [
  { re: /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/, why: "fork bomb" },
  { re: /\bdd\b[^|;]*\bof=\/dev\/(disk|sd|hd|nvme)/, why: "raw write to a disk device" },
  { re: /\bmkfs(\.\w+)?\b/, why: "filesystem reformat" },
  { re: />\s*\/dev\/(disk|sd|hd|nvme)\d/, why: "redirect onto a disk device" },
  { re: /\bgit\s+push\b[^|;]*\s--mirror\b/, why: "git push --mirror can delete remote refs" },
];

// --- PR base (for diffing only, not for enforcing a flow) ------------------

/** `gh pr create ... --base X` / `-B X` / `--base=X`, else null. */
function prBase(cmd) {
  if (!/\bgh\s+pr\s+create\b/.test(cmd)) return null;
  const m = cmd.match(/(?:--base[=\s]+|-B\s+)([^\s"']+)/);
  return m ? m[1] : null;
}

// --- GitHub prose caps -----------------------------------------------------

// Caps come from rules/writing-style.md. Bullet length is the primary signal:
// the observed failure mode is a small number of enormous bullets, not many
// small ones, so a total-size cap alone would let the worst bodies through.
// 180 chars ≈ the 25-word cap in writing-style.md. Calibrated against real
// bodies: a real 320-character offender measured 250 of prose, so a
// 250 cap let the exact case this was built for through by one character.
// Commit bullets are tighter than PR bullets: a commit body is read in
// `git log --oneline` context, where anything past a line wraps into noise.
const BULLET_CHARS = { pr: 180, comment: 180, commit: 120 };
const BODY_CHARS = { pr: 4000, comment: 2500, commit: 800 };
const SUBJECT_CHARS = 72;

// Only phrases with no honest use in a PR body or issue comment. Anything
// arguable (`comprehensive`, `robust`, `simply`) is left to writing-style.md —
// this list has to stay small enough that a hit is never a judgement call.
const FILLER = [
  /\b(?:I(?:'ve| have)|we(?:'ve| have))\s+successfully\b/i,
  /\bsuccessfully\s+(?:implemented|added|created|completed|fixed|updated)\b/i,
  /\bthis\s+PR\s+(?:does|aims to|serves to|seeks to)\b/i,
  /\b(?:great|excellent|good)\s+(?:question|point|catch)\b/i,
  /\bit(?:'s| is)\s+worth\s+noting\s+that\b/i,
  /\b(?:in summary|to summarize|in conclusion)\b/i,
  /\blet me know if you have any (?:questions|concerns)\b/i,
];

/** Which gh write-command this is, or null if it isn't one. */
function ghBodyKind(cmd) {
  if (/\bgh\s+pr\s+(?:create|edit)\b/.test(cmd)) return "pr";
  if (/\bgh\s+(?:issue|pr)\s+comment\b/.test(cmd)) return "comment";
  if (/\bgh\s+issue\s+create\b/.test(cmd)) return "comment";
  return null;
}

/**
 * Pull the body text out of the command. `--body-file` is read from disk;
 * `--body` takes everything after the flag, which is crude but correct for the
 * heredoc form our skills use (`--body "$(cat <<'EOF' ... EOF)"`) since the
 * text sits inline in the command string. Returns null when there's nothing to
 * check — an unreadable file or a missing flag must not block the call.
 */
function extractBody(cmd, cwd) {
  const file = cmd.match(/--body-file[=\s]+(["']?)([^\s"']+)\1/);
  if (file) return readFlagFile(file[2], cwd);

  const i = cmd.search(/--body[=\s]/);
  if (i === -1) return null;
  return unwrapShell(cmd.slice(i).replace(/^--body[=\s]+/, ""));
}

function readFlagFile(p, cwd) {
  if (p === "-" || p === "/dev/stdin") return null; // piped; nothing to read
  try {
    return fs.readFileSync(path.resolve(cwd, p), "utf8");
  } catch {
    return null;
  }
}

/**
 * Strip the shell wrapper so line 1 of the result is line 1 of the markdown.
 * Without this a single-line `--body "- ..."` keeps its leading quote, the
 * bullet regex misses, and the longest bullets sail through unchecked.
 */
function unwrapShell(text) {
  let out = text.replace(/^"\$\(\s*cat\s*<<-?\s*['"]?\w+['"]?\s*\n?/, "");
  out = out.replace(/\n?\w+\s*\n?\)"\s*$/, "");
  out = out.replace(/^(["'])([\s\S]*)\1\s*$/, "$2");
  return out.replace(/^["']/, "").replace(/["']\s*$/, "");
}

/**
 * The commit message, or null when there's nothing inline to check (an editor
 * commit, or a `-F` file we can't read). `-am` and friends are matched too.
 */
function commitMessage(cmd, cwd) {
  if (!/\bgit\s+commit\b/.test(cmd)) return null;
  const file = cmd.match(/(?:-F|--file)[=\s]+(["']?)([^\s"']+)\1/);
  if (file) return readFlagFile(file[2], cwd);

  const i = cmd.search(/\s-[a-zA-Z]*m[=\s]/);
  if (i === -1) return null;
  const msg = cmd.slice(i).replace(/^\s*-[a-zA-Z]*m[=\s]+/, "");
  // Repeated `-m` flags are separate paragraphs of one message.
  return unwrapShell(msg).split(/["']?\s+-m\s+["']?/).join("\n\n");
}

/**
 * Length of a line's PROSE — URLs, inline code and markdown link targets are
 * stripped first. A bullet is long because of clauses, not because it cites a
 * path or a link, and blocking the latter would be pure noise.
 */
function proseLength(line) {
  return line
    .replace(/`[^`]*`/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Returns a block reason, or null if the body passes. */
function checkProse(body, kind) {
  for (const re of FILLER) {
    const hit = body.match(re);
    if (hit) {
      return (
        `filler phrase "${hit[0]}" in a ${kind} body.\n` +
        `rules/writing-style.md bans it. Delete the phrase and state the fact.`
      );
    }
  }

  const bulletCap = BULLET_CHARS[kind];
  for (const line of body.split("\n")) {
    if (!/^\s*[-*]\s+/.test(line)) continue;
    const len = proseLength(line);
    if (len > bulletCap) {
      return (
        `a bullet runs ${len} chars of prose (cap ${bulletCap}):\n` +
        `  ${line.trim().slice(0, 120)}...\n` +
        `Split it. One clause per bullet — no trailing "— which resolves..." tails.`
      );
    }
  }

  const cap = BODY_CHARS[kind];
  if (body.length > cap) {
    return (
      `${kind} body is ${body.length} chars (cap ${cap}).\n` +
      `Cut narration and self-assessment; keep facts, paths and tradeoffs.`
    );
  }
  return null;
}

function checkCommit(msg) {
  const subject = msg.split("\n")[0].trim();
  if (subject.length > SUBJECT_CHARS) {
    return (
      `commit subject is ${subject.length} chars (cap ${SUBJECT_CHARS}):\n` +
      `  ${subject.slice(0, 100)}\n` +
      `Move the detail into a bullet.`
    );
  }
  return checkProse(msg, "commit");
}

// --- PR size ---------------------------------------------------------------

// From skills/pr-sizing. Only hand-written logic counts toward the budget:
// docs are linear prose, tests are read as a list of cases, and lockfiles are
// reviewed by reading the command that produced them.
const LOGIC_LINE_CAP = 400;

const NOT_LOGIC = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|uv\.lock|Cargo\.lock|mix\.lock|go\.sum|Gemfile\.lock)$/,
  /(^|\/)(dist|build|vendor|node_modules|__snapshots__|fixtures?)\//,
  /\.(md|mdx|rst|txt|snap|lock|svg|png|jpg|jpeg|gif|ico)$/,
  /(^|\/)(docs?|test|tests|spec)\//,
  /(^|\/)[^/]*[._-](test|spec)\.[\w]+$/,
  /(^|\/)test_[^/]+$/,
  /\.generated\.[\w]+$/,
];

/** Added lines of hand-written logic vs `base`, or null if git can't tell us. */
function logicLines(base, cwd) {
  let out;
  try {
    out = execFileSync("git", ["diff", "--numstat", `${base}...HEAD`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }

  let total = 0;
  for (const line of out.split("\n")) {
    const [added, , file] = line.split("\t");
    if (!file || added === "-") continue;
    if (NOT_LOGIC.some((re) => re.test(file))) continue;
    total += Number(added) || 0;
  }
  return total;
}

function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }) + "\n"
  );
  process.exit(0);
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

  const command = hookData.tool_input?.command || "";
  const cwd = hookData.cwd || process.cwd();

  for (const { re, why } of BLOCKED_PATTERNS) {
    if (re.test(command)) {
      console.error(`[guard-bash] BLOCKED (${why}): ${command}`);
      process.exit(2);
    }
  }

  // Prose caps run after the destructive check so a body-shape complaint never
  // buries a genuinely dangerous command.
  const kind = ghBodyKind(command);
  if (kind) {
    const body = extractBody(command, cwd);
    const reason = body && checkProse(body, kind);
    if (reason) {
      console.error(`[guard-bash] BLOCKED: ${reason}`);
      process.exit(2);
    }
  }

  const msg = commitMessage(command, cwd);
  if (msg) {
    const reason = checkCommit(msg);
    if (reason) {
      console.error(`[guard-bash] BLOCKED: ${reason}`);
      process.exit(2);
    }
  }

  // Size is a judgement call — a schema change and the code that reads it has
  // to ship together — so this asks rather than blocks.
  if (/\bgh\s+pr\s+create\b/.test(command)) {
    const lines = logicLines(prBase(command) || "main", cwd);
    if (lines !== null && lines > LOGIC_LINE_CAP) {
      return decide(
        "ask",
        `This PR adds ${lines} lines of hand-written logic (docs, tests, lockfiles and ` +
          `generated files excluded). rules/pr-sizing.md puts the reconsider line at ` +
          `${LOGIC_LINE_CAP}. Split it, or say which exception applies: it doesn't work ` +
          `in pieces, splitting ships a broken intermediate state, or it's mechanical.`
      );
    }
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
