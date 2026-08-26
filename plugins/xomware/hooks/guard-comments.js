#!/usr/bin/env node
/**
 * guard-comments.js
 * Fires on PreToolUse for Edit|Write. Blocks one specific shape: a single-line
 * comment that restates the line of code directly beneath it.
 *
 * This exists because the obvious version of this guard — cap comment volume,
 * or comment-to-code ratio — is wrong. The comment that prompted it was nine
 * lines explaining why a memo replaced per-path enumeration, with the perf
 * numbers and the correctness argument. rules/code-style.md protects exactly
 * that ("the comment explaining the weird thing"), and a volume threshold
 * deletes it while sailing straight past `# calculate the total`. Length does
 * not separate a good comment from a bad one. Restatement does.
 *
 * So the test is narrow on purpose:
 *   - single-line comment only; two or more consecutive comment lines are
 *     exempt, because that is the shape of a real explanation
 *   - the comment must be short (<= MAX_WORDS content words)
 *   - anything carrying why-signal (an issue ref, a URL, "because", "instead",
 *     "upstream", ...) is exempt
 *   - narration verbs are stripped, then what remains must be almost entirely
 *     present in the identifiers on the next line
 *
 * Exit 0 = allow. Exit 2 = block; the session rewrites and retries, so a hit
 * costs no human attention. Fails open on any internal error — a broken guard
 * must never wedge the session.
 *
 * Requires Node.js >= 16.
 */

const [major] = process.versions.node.split(".").map(Number);
if (major < 16) {
  process.stderr.write("[guard-comments] Node >= 16 required. Hook disabled.\n");
  process.exit(0);
}

const readline = require("readline");
const path = require("path");

// Line-comment marker by extension. Absent = not checked, which is the right
// default for Markdown (all prose), JSON (no comments) and lockfiles.
const MARKERS = {
  ".py": "#", ".rb": "#", ".sh": "#", ".bash": "#", ".zsh": "#",
  ".yml": "#", ".yaml": "#", ".tf": "#", ".hcl": "#", ".ex": "#", ".exs": "#",
  ".js": "//", ".mjs": "//", ".cjs": "//", ".ts": "//", ".tsx": "//",
  ".jsx": "//", ".go": "//", ".swift": "//", ".rs": "//", ".java": "//",
  ".c": "//", ".h": "//", ".cpp": "//", ".hpp": "//", ".kt": "//", ".scala": "//",
};

const MAX_WORDS = 8;       // longer comments are doing real work; exempt them
const MATCH_RATIO = 0.6;   // share of surviving content words found in the code
const MAX_REPORTED = 3;

// Tests label their cases in exactly the shape this guard hunts for — `# double
// -accept -> None`, `# user-f is unaffected` — and those labels are the point of
// the test. 66 of the first 100 files this flagged across our repos were tests,
// all of them false. Generated files aren't ours to edit either.
const EXEMPT_PATH = /(?:^|[\/\\])(?:tests?|__tests__|spec|fixtures?)[\/\\]|(?:^|[\/\\])conftest\.py$|(?:^|[\/\\])test_|_test\.|\.test\.|_spec\.|\.spec\.|Tests?\.(?:swift|java|kt)$|\.d\.ts$|[\/\\]generated[\/\\]|\.generated\.|_pb2\.py$/;

// A section divider is not a narration of the line beneath it. Covers the
// `# # Tags` idiom in our locals.tf files and any box-drawing rule.
const HEADER = /^[#*=~\-─━—_+]|[─━=*_~+]{3,}/;

// Pure narration. A comment made only of these plus stopwords says nothing the
// code doesn't. Stripped before scoring so `# calculate the total` reduces to
// {total}, which `total = sum(prices)` then fully covers.
const NARRATION = new Set([
  "calculate", "calculates", "compute", "computes", "get", "gets", "set", "sets",
  "return", "returns", "create", "creates", "make", "makes", "build", "builds",
  "initialize", "initialise", "init", "declare", "define", "defines", "setup",
  "loop", "loops", "iterate", "iterates", "walk", "check", "checks", "handle",
  "handles", "process", "processes", "convert", "converts", "parse", "parses",
  "increment", "decrement", "add", "adds", "append", "appends", "update",
  "updates", "store", "stores", "save", "saves", "call", "calls", "run", "runs",
  "do", "does", "start", "starts", "stop", "stops", "read", "reads", "write",
  "writes", "load", "loads", "find", "finds", "filter", "filters", "map",
  "extract", "extracts", "assign", "assigns", "setting", "getting", "now",
  "then", "here", "first", "next", "finally", "step",
]);

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "to",
  "of", "for", "in", "on", "at", "by", "from", "with", "as", "and", "or", "if",
  "it", "its", "this", "that", "these", "those", "we", "our", "us", "you",
  "all", "any", "each", "every", "into", "out", "up", "down", "over", "back",
  "not", "no", "so", "just", "only", "new", "old", "one", "two", "s",
]);

// Why-signal: a comment containing any of these is explaining, not narrating.
const WHY = /\b(?:because|since|instead|otherwise|avoid|avoids|workaround|upstream|bug|breaks|broken|fails|would|cannot|can't|must|deliberate|deliberately|intentional|intentionally|but|however|unless|beware|careful|assumes|assumption|why|hack)\b/i;
const REF = /(?:https?:\/\/|#\d+|[A-Z]{2,}-\d+)/;

// An arrow states a mapping — `# deal_institutions -> deal_clients` names both
// sides of a rename the code only shows one of. That is information.
const MAPS = /(?:→|->|=>|==|!=)/;

// Tool and linter directives are contracts, not prose.
const DIRECTIVE = /^(?:!|type:|noqa|nosec|pylint|flake8|mypy|ruff|eslint|prettier|tslint|@ts-|jshint|global|istanbul|c8|v8|coding[:=]|-\*-|TODO|FIXME|XXX|HACK|NOTE|SAFETY|biome-ignore|deno-lint)/i;

/** Lowercase, drop a trailing plural `s`, so `retries` and `retry` don't miss. */
function norm(w) {
  const s = w.toLowerCase();
  return s.length > 3 && s.endsWith("s") ? s.slice(0, -1) : s;
}

/** Identifiers on a code line, split on non-alphanumerics and camelCase. */
function codeTokens(line) {
  const out = new Set();
  for (const raw of line.split(/[^A-Za-z0-9]+/)) {
    if (!raw) continue;
    out.add(norm(raw));
    for (const part of raw.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ")) {
      if (part) out.add(norm(part));
    }
  }
  return out;
}

/**
 * Does `comment` restate `code`? Returns the reason string, or null.
 */
function restates(comment, code) {
  if (WHY.test(comment) || REF.test(comment) || MAPS.test(comment)) return null;
  if (DIRECTIVE.test(comment.trim()) || HEADER.test(comment.trim())) return null;

  const words = comment.split(/[^A-Za-z0-9']+/).filter(Boolean);
  if (!words.length || words.length > MAX_WORDS) return null;

  const content = words.map(norm).filter((w) => !STOP.has(w));
  if (!content.length) return null;

  const meaningful = content.filter((w) => !NARRATION.has(w));

  // Nothing left but narration verbs — `# initialize`, `# loop over rows`.
  if (!meaningful.length) return "says only what the code is doing";

  // A comment with no narration verb is a label, not a narration — `// AI Search
  // V2 Response Types` over `type AiSearchSearchResponse`. Only call it a
  // restatement when the line below covers it completely.
  const floor = meaningful.length === content.length ? 1 : MATCH_RATIO;

  const tokens = codeTokens(code);
  const hits = meaningful.filter((w) => tokens.has(w));
  if (hits.length / meaningful.length < floor) return null;

  return "every word already appears in the line below it";
}

/** Offending comments in `text`, skipping any that also exist in `prior`. */
function scan(text, marker, prior) {
  const lines = text.split("\n");
  const isComment = (l) => l.trim().startsWith(marker);
  const found = [];

  for (let i = 0; i < lines.length; i++) {
    if (!isComment(lines[i])) continue;

    // A run of two or more comment lines is an explanation. Skip the whole run.
    if (isComment(lines[i + 1] || "") || (i > 0 && isComment(lines[i - 1]))) {
      while (i < lines.length && isComment(lines[i])) i++;
      continue;
    }

    const code = lines[i + 1];
    if (!code || !code.trim() || isComment(code)) continue;

    const body = lines[i].trim().slice(marker.length).trim();
    if (!body) continue;

    const reason = restates(body, code);
    if (!reason) continue;
    if (prior.includes(lines[i].trim())) continue; // pre-existing, not this edit

    found.push({ comment: body, code: code.trim(), reason });
  }
  return found;
}

async function main() {
  let input = "";
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) input += line;

  let hook = {};
  try {
    hook = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const file = hook.tool_input?.file_path || hook.tool_input?.path || "";
  if (EXEMPT_PATH.test(file)) process.exit(0);

  const marker = MARKERS[path.extname(file).toLowerCase()];
  if (!marker) process.exit(0);

  const text = hook.tool_input?.new_string ?? hook.tool_input?.content ?? "";
  if (!text) process.exit(0);

  const hits = scan(text, marker, hook.tool_input?.old_string || "");
  if (!hits.length) process.exit(0);

  const detail = hits
    .slice(0, MAX_REPORTED)
    .map((h) => `  ${marker} ${h.comment}\n  ${h.code}\n    -> ${h.reason}`)
    .join("\n\n");

  process.stderr.write(
    `[guard-comments] ${hits.length} comment(s) in ${path.basename(file)} restate ` +
      `the code below them. rules/code-style.md: comments explain why, never what.\n\n` +
      `${detail}\n\n` +
      `Delete them and retry. If one is carrying a real reason, rewrite it to lead ` +
      `with that reason rather than the action.\n`
  );
  process.exit(2);
}

main().catch(() => process.exit(0));
