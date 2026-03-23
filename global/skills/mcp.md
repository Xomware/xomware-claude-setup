---
name: mcp
description: Use when building or integrating MCP (Model Context Protocol) servers or clients — defining tools, resources, prompts, or connecting to existing MCP servers via Claude Code or the Anthropic API.
---

# MCP Patterns — Areté

## What MCP Is
MCP lets Claude interact with external systems through a standard protocol. You build an MCP server that exposes tools/resources, and Claude calls them like any other tool.

## MCP Server — TypeScript (SDK)
```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "arete-[feature]-mcp",
  version: "1.0.0",
});

// Define a tool
server.tool(
  "get_client_data",
  "Fetch client data by ID",
  {
    client_id: z.string().describe("The client ID to look up"),
    include_history: z.boolean().optional().default(false),
  },
  async ({ client_id, include_history }) => {
    const data = await fetchClient(client_id, { include_history });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// Define a resource (read-only data)
server.resource(
  "client_list",
  "arete://clients",
  { mimeType: "application/json" },
  async () => {
    const clients = await listClients();
    return {
      contents: [{
        uri: "arete://clients",
        mimeType: "application/json",
        text: JSON.stringify(clients),
      }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## MCP Server — Python (SDK)
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("arete-feature-mcp")

@mcp.tool()
async def get_client_data(client_id: str, include_history: bool = False) -> str:
    """Fetch client data by ID."""
    data = await fetch_client(client_id, include_history=include_history)
    return json.dumps(data)

@mcp.resource("arete://clients")
async def client_list() -> str:
    """List all active clients."""
    clients = await list_clients()
    return json.dumps(clients)

if __name__ == "__main__":
    mcp.run()
```

## Connecting MCP to Claude Code
```json
// ~/.claude/settings.json or project .claude/settings.json
{
  "mcpServers": {
    "arete-feature": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

## Using MCP in Anthropic API calls
```ts
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Get data for client 123" }],
  mcp_servers: [
    {
      type: "url",
      url: "https://your-mcp-server.com/sse",
      name: "arete-feature",
    }
  ],
});
```

## Tool Design Rules
- **One responsibility per tool** — don't build a god tool with 10 params
- **Descriptive names and docstrings** — Claude uses these to decide when to call the tool
- **Validate inputs with zod/pydantic** — never trust raw args
- **Return structured data** — JSON strings Claude can parse and reason about
- **Handle errors gracefully** — return error messages as content, don't throw
- **Idempotent read tools** — tools that read should never have side effects

## Testing MCP Servers
```bash
# Test locally with MCP inspector
npx @modelcontextprotocol/inspector node dist/index.js

# Or pipe JSON-RPC directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```
