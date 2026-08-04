#!/usr/bin/env node
/**
 * guard-bash.js
 * Fires on PreToolUse for Bash.
 * Blocks a short list of truly destructive commands.
 * Everything else passes through — this is NOT yolo mode off,
 * just a last-resort guard for the worst offenders.
 *
 * Requires Node.js >= 16. Exits 0 (allow) if runtime check fails — never blocks Claude.
 * Exit code 2 = block. Exit code 0 = allow.
 */

// Graceful Node version check
const [major] = process.versions.node.split(".").map(Number);
if (major < 16) {
  process.stderr.write("[guard-bash] Node >= 16 required. Hook disabled.\n");
  process.exit(0);
}

const readline = require("readline");

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\/(?!\S)/,        // rm -rf / (root wipe)
  /rm\s+-rf\s+~\s*$/,            // rm -rf ~
  /rm\s+-rf\s+\.\s*$/,           // rm -rf . (cwd wipe with no path)
  /:\(\)\{\s*:\|:&\s*\};:/,      // fork bomb
  /dd\s+if=.*of=\/dev\/(sd|hd)/, // disk wipe via dd
  /mkfs\./,                       // reformat filesystem
  />\s*\/dev\/sd/,               // write directly to disk device
];

async function main() {
  let input = "";
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    input += line;
  }

  let hookData = {};
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0); // don't block on parse failure
  }

  const command = hookData.tool_input?.command || "";

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      console.error(`[guard-bash] BLOCKED: matched pattern ${pattern}`);
      process.exit(2);
    }
  }

  // Allow
  process.exit(0);
}

main().catch(() => process.exit(0));
