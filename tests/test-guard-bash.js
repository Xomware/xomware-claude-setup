#!/usr/bin/env node
// Test harness for guard-bash.js. Cases live in this file so the patterns under
// test never appear in a shell command line (the guard would block its own test).
//
// Usage: node tests/test-guard-bash.js <path-to-guard-bash.js> [cwd]
//
// No branch-flow cases: Xomware repos are main-based and the guard carries no
// base-branch rule. A repo wanting a different target sets base_branch in its
// Project Config, which /pr reads.
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOOK = process.argv[2];

if (!HOOK) {
  console.error("usage: node tests/test-guard-bash.js <path-to-guard-bash.js> [cwd]");
  process.exit(2);
}

// The PR-size check diffs the cwd against its base branch, so running these
// cases in this repo makes the result depend on how big the current branch
// happens to be — the suite passed before this branch grew past 400 lines and
// failed after, testing nothing but the working tree. Every case runs against a
// throwaway repo with an empty diff instead.
function cleanRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-bash-"));
  const git = (...args) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf8", stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  fs.writeFileSync(path.join(dir, "README.md"), "# fixture\n");
  git("add", "-A");
  git("commit", "-qm", "init");
  return dir;
}

const CWD = process.argv[3] || cleanRepo();

// Assembled, never written whole. This file gets created by shell heredocs, and
// a literal fork bomb or reformat command in the command line trips the very
// guard under test — which is itself the guard working correctly.
const DISK = "/dev/" + "disk";
const FORK = ":" + "(){ " + ":|" + ":& };" + ":";
const MKFS = "mk" + "fs" + ".ext4 " + DISK + "2";

const cases = [
  ["catastrophic", MKFS, "deny"],
  ["catastrophic", "dd if=/dev/zero of=" + DISK + "3", "deny"],
  ["catastrophic", "git push --mirror origin", "deny"],
  ["catastrophic", FORK, "deny"],

  ["benign", "npm test", "allow"],
  ["benign", 'git commit -m "#42 add coverage calculation"', "allow"],
  ["benign", "echo main", "allow"],
  ["benign", "git log main..HEAD --oneline", "allow"],
  ["benign", "gh pr list --base main", "allow"],
  // Nothing here enforces a base branch any more.
  ["benign", "gh pr create --base main --title x", "allow"],
  ["benign", "git push origin main", "allow"],

  // --- prose caps -----------------------------------------------------------
  // Offending bodies are built here rather than pasted so the file stays readable.
  ["prose", 'gh issue comment 5 --body "## Done\n- ' + "word ".repeat(60) + '"', "deny"],
  ["prose", 'gh pr create --body "## What\n- adds a flag"', "allow"],
  ["prose", 'gh issue comment 5 --body "I have successfully added the flag"', "deny"],
  ["prose", 'gh pr create --body "This PR does the following"', "deny"],
  ["prose", 'gh issue comment 5 --body "In summary, the fix works"', "deny"],
  // A bullet long only because of a URL and a path must NOT trip.
  [
    "prose",
    'gh issue comment 5 --body "- see `' +
      "a/very/long/path/".repeat(12) +
      'x.py` and https://example.com/' +
      "y".repeat(120) +
      '"',
    "allow",
  ],
  // Boundary pair around BULLET_CHARS=180. "wordy " is 6 chars, so 29 reps is
  // 173 of prose (under) and 31 is 185 (over). Pins the calibration: a 250 cap
  // let the real 320-character offender through by one character.
  ["prose", 'gh issue comment 5 --body "- ' + "wordy ".repeat(29) + '"', "allow"],
  ["prose", 'gh issue comment 5 --body "- ' + "wordy ".repeat(31) + '"', "deny"],
  // Read-only gh commands are never inspected.
  ["prose", "gh pr view 5 --json body", "allow"],
  ["prose", "gh issue list --search 'successfully added'", "allow"],
  // Missing --body-file target fails open rather than blocking the call.
  ["prose", "gh pr create --body-file /nonexistent/path.md", "allow"],
];

let fail = 0;
for (const [group, command, want] of cases) {
  const r = spawnSync("node", [HOOK], {
    input: JSON.stringify({ tool_input: { command }, cwd: CWD }),
    encoding: "utf8",
  });
  let got = "allow";
  if (r.status === 2) got = "deny";
  else if (r.stdout && r.stdout.trim()) {
    try {
      const d = JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision;
      if (d) got = d;
    } catch {}
  }
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  [${group}] want=${want} got=${got}  ${command}`);
}
console.log(fail === 0 ? "\nAll cases passed." : `\n${fail} case(s) FAILED.`);
process.exit(fail === 0 ? 0 : 1);
