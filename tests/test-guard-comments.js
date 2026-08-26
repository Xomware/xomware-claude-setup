#!/usr/bin/env node
// Test harness for guard-comments.js. Same shape as test-guard-bash.js.
//
// The allow cases matter more than the block cases here. This guard replaced a
// proposed comment-volume check, and the whole reason for the rewrite was that
// volume deletes the nine-line comment explaining why a memo is correct. If an
// allow case starts failing, the guard has regressed into the thing it replaced.
const { spawnSync } = require("child_process");

const HOOK = process.argv[2];

// Built with an array join so a bad pattern never sits in this file as a real
// comment — the guard checks .js and would flag its own test fixtures.
const c = (...lines) => lines.join("\n") + "\n";

const cases = [
  // --- must allow: real explanations ---------------------------------------
  [
    "multi-line why block (the case that prompted this hook)",
    "f.py",
    c(
      "# Memoized on (step, capabilities-so-far) rather than per-path.",
      "# Enumerating simple paths was exponential in the diamond count — 13.9s",
      "# at 61 steps, hours at ~90, on the event loop (#1459).",
      'by_id = {s.get("id"): s for s in steps}'
    ),
    "allow",
  ],
  ["issue ref", "f.py", c("# memo bounds this at len(CAPABILITIES) (#1459)", "caps = {}"), "allow"],
  ["because", "f.py", c("# skipped because the upstream parser chokes on BOM", "rows = load(path)"), "allow"],
  ["business rule", "f.py", c("# prices exclude tax", "total = sum(prices)"), "allow"],
  ["partial overlap only", "f.py", c("# bump the retry ceiling", "MAX_RETRIES = 5"), "allow"],
  ["tf section divider", "f.tf", c("# # Tags", "tags = merge(local.base_tags, {"), "allow"],
  ["box rule divider", "f.py", c("# ── Stage ──────────────", 'stage = "prod"'), "allow"],
  ["label, not fully covered", "f.ts", c("// AI Search V2 Response Types", "type AiSearchSearchResponse = {"), "allow"],
  ["states a mapping", "f.py", c("# Remap deal_institutions → deal_clients", "n = remap_deal_institutions(http)"), "allow"],
  ["linter directive", "f.py", c("# noqa: E501", "x = 1"), "allow"],
  ["eslint directive", "f.ts", c("// eslint-disable-next-line no-console", "console.log(x)"), "allow"],
  ["TODO", "f.py", c("# TODO: split this once #22 lands", "run()"), "allow"],
  ["markdown is never checked", "f.md", c("# calculate the total", "total = sum(prices)"), "allow"],
  ["tests are exempt", "test_thing.py", c("# Load institutions", "institutions = fetch()"), "allow"],
  ["generated .d.ts exempt", "worker-configuration.d.ts", c("// Hero", "heroEyebrow: z.string(),"), "allow"],

  // --- must block: restatement --------------------------------------------
  ["canonical", "f.py", c("# calculate the total", "total = sum(prices)"), "deny"],
  ["increment", "f.py", c("# increment the counter", "counter += 1"), "deny"],
  ["bare narration verb", "f.py", c("# initialize", "cache = {}"), "deny"],
  ["loop narration", "f.py", c("# loop over the rows", "for row in rows:"), "deny"],
  ["restates function name", "f.py", c("# parse the config", "def parse_config(path):"), "deny"],
  ["js assignment", "f.ts", c("// set the timeout", "const timeout = 5000"), "deny"],
  ["env lookup", "f.py", c("# Check for API key", 'api_key = os.getenv("API_KEY")'), "deny"],
  ["logging setup", "f.py", c("# Set up logging", "logging.basicConfig(level=logging.INFO)"), "deny"],
  ["step scaffolding", "f.py", c("# Step 4: Rate limiting", 'results["rate_limit"] = test_rate_limiting(c)'), "deny"],
  ["private fn name", "f.py", c("# get user email", "def _user_email() -> str | None:"), "deny"],
];

let fail = 0;
for (const [group, file, content, want] of cases) {
  const r = spawnSync("node", [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: file, content } }),
    encoding: "utf8",
  });
  const got = r.status === 2 ? "deny" : "allow";
  const ok = got === want;
  if (!ok) fail++;
  const first = content.split("\n")[0];
  console.log(`${ok ? "PASS" : "FAIL"}  [${group}] want=${want} got=${got}  ${file}: ${first}`);
}
console.log(fail === 0 ? "\nAll cases passed." : `\n${fail} case(s) FAILED.`);
process.exit(fail === 0 ? 0 : 1);
