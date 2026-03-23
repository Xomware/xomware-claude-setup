---
name: nodejs
description: Use when writing Node.js scripts, servers, CLI tools, or utilities. Covers module patterns, async, error handling, and Areté-specific conventions.
---

# Node.js Patterns — Areté

## Module Structure
```js
// Prefer ES modules in new projects
// package.json: "type": "module"
import { something } from "./module.js"; // always include .js extension

// CommonJS (legacy / scripts)
const { something } = require("./module");
```

## Async Patterns
```js
// Always async/await over raw promises
async function fetchData(id) {
  const result = await db.query(id);
  return result;
}

// Parallel when independent
const [users, settings] = await Promise.all([
  getUsers(),
  getSettings(),
]);

// Never unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});
```

## Error Handling
```js
// Typed errors for recoverable cases
class AppError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Result pattern for expected failures (avoid try/catch soup)
async function safeRun(fn) {
  try {
    return { data: await fn(), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

const { data, error } = await safeRun(() => fetchUser(id));
if (error) { /* handle */ }
```

## Environment / Config
```js
// Always validate env vars at startup — fail fast
const requiredEnv = ["DATABASE_URL", "ANTHROPIC_API_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}
```

## Scripts
```js
#!/usr/bin/env node
// Add to package.json scripts, not as standalone executables
// Use process.argv or a parser like @std/cli / minimist for args

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    env: { type: "string", default: "development" },
    dry: { type: "boolean", default: false },
  },
});
```

## Rules
- No `var` — `const` by default, `let` when reassignment needed
- No callbacks — async/await only
- Exit with `process.exit(1)` on fatal errors, `0` on success
- Log to `stderr` for errors/debug, `stdout` for output
- Use `node:` prefix for built-ins: `import fs from "node:fs"`
