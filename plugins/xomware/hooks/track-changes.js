#!/usr/bin/env node
/**
 * track-changes.js
 * Fires on PostToolUse for Edit|Write.
 * Appends modified file paths to .claude/memory/dirty-files
 * so the Stop hook / memory-updater agent knows what changed.
 *
 * Zero token cost — just file I/O, no LLM calls.
 * Requires Node.js >= 16. Exits 0 silently if unavailable.
 */

const [major] = process.versions.node.split(".").map(Number);
if (major < 16) { process.exit(0); }

const fs = require("fs");
const path = require("path");
const readline = require("readline");

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
    process.exit(0);
  }

  const cwd = hookData.cwd || process.cwd();
  const memoryDir = path.join(cwd, ".claude", "memory");
  const dirtyFile = path.join(memoryDir, "dirty-files");

  if (!fs.existsSync(path.join(cwd, ".claude"))) {
    process.exit(0);
  }

  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  // Extract file path from tool input
  const filePath =
    hookData.tool_input?.file_path ||
    hookData.tool_input?.path ||
    null;

  if (filePath) {
    fs.appendFileSync(dirtyFile, filePath + "\n", "utf8");
  }

  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main().catch(() => process.exit(0));
