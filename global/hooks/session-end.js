#!/usr/bin/env node
/**
 * session-end.js
 * Fires on Stop hook. Appends a timestamped session summary prompt
 * to the active project's memory log so learnings aren't lost.
 *
 * Requires: Node.js >= 16. Exits 0 silently if unavailable.
 * Install: referenced in ~/.claude/settings.json Stop hook
 */

const [major] = process.versions.node.split(".").map(Number);
if (major < 16) { process.exit(0); }

const fs = require("fs");
const path = require("path");
const readline = require("readline");

async function main() {
  // Read hook input from stdin
  let input = "";
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    input += line;
  }

  let hookData = {};
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0); // non-blocking — don't break Claude if hook fails
  }

  const cwd = hookData.cwd || process.cwd();
  const memoryDir = path.join(cwd, ".claude", "memory");
  const logFile = path.join(memoryDir, "session-log.md");

  // Only write if we're inside a project with a .claude folder
  if (!fs.existsSync(path.join(cwd, ".claude"))) {
    process.exit(0);
  }

  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  // Check if /end-session already ran this session (wrote a real entry)
  // by looking for a session entry with today's date that has actual content
  // (not just the auto-captured stub). If found, skip the stub.
  const timestamp = new Date().toISOString().split("T")[0];
  const sessionId = hookData.session_id ? hookData.session_id.slice(0, 8) : "unknown";

  if (fs.existsSync(logFile)) {
    const existing = fs.readFileSync(logFile, "utf8");
    // If there's already a real entry for today (has "### What was built"), skip stub
    const todayPattern = new RegExp(`## Session ${timestamp}[\\s\\S]*?### What was built`);
    if (todayPattern.test(existing)) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }
    // If there's already a stub for this exact session ID, skip duplicate
    if (existing.includes(`(${sessionId})`)) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }
  }

  // Only write a stub if dirty-files has content (something was actually changed)
  const dirtyFile = path.join(memoryDir, "dirty-files");
  const hasDirtyFiles = fs.existsSync(dirtyFile) && fs.readFileSync(dirtyFile, "utf8").trim().length > 0;

  if (!hasDirtyFiles) {
    // No files changed — skip stub entirely (read-only sessions don't need stubs)
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  const entry = `
---
## Session ${timestamp} (${sessionId})
> Auto-captured on Stop. Run /sync-memory to backfill from git if /end-session was skipped.

`;

  fs.appendFileSync(logFile, entry, "utf8");

  // Output JSON to signal success without blocking
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main().catch(() => process.exit(0));
