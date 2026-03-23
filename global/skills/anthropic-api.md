---
name: anthropic-api
description: Use when calling the Anthropic API — building Claude-powered features, artifacts, agentic workflows, or MCP integrations.
---

# Anthropic API — Areté Patterns

## Basic Completion

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // uses ANTHROPIC_API_KEY env var

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Your prompt here" }
  ],
});

const text = response.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("");
```

## Model Selection
| Use Case | Model |
|----------|-------|
| Complex reasoning, planning | `claude-opus-4-20250514` |
| General tasks (default) | `claude-sonnet-4-20250514` |
| Fast, cheap, simple tasks | `claude-haiku-4-5-20251001` |

## Streaming

```ts
const stream = await client.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
});

for await (const chunk of stream) {
  if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
    process.stdout.write(chunk.delta.text);
  }
}
```

## Structured JSON Output

```ts
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  system: "Respond ONLY with valid JSON. No preamble, no markdown fences.",
  messages: [{ role: "user", content: prompt }],
});

const raw = response.content[0].type === "text" ? response.content[0].text : "";
const data = JSON.parse(raw.replace(/```json|```/g, "").trim());
```

## Multi-turn Conversation

```ts
const history: Anthropic.MessageParam[] = [];

async function chat(userMessage: string) {
  history.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: history,
  });

  const assistantText = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  history.push({ role: "assistant", content: assistantText });
  return assistantText;
}
```

## Error Handling

```ts
import { APIError } from "@anthropic-ai/sdk";

try {
  const response = await client.messages.create({ /* ... */ });
} catch (error) {
  if (error instanceof APIError) {
    console.error(`Anthropic API error ${error.status}:`, error.message);
    // 429 = rate limit, 529 = overloaded — implement retry with backoff
  }
  throw error;
}
```

## Python SDK

### Basic Completion
```python
import anthropic

client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Your prompt here"}
    ],
)

text = "".join(
    block.text for block in message.content if block.type == "text"
)
```

### Async Client
```python
import anthropic

client = anthropic.AsyncAnthropic()

message = await client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}],
)
```

### Streaming (Python)
```python
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### Tool Use (Structured Output)
```python
import anthropic
from pydantic import BaseModel

# Define the schema as a tool
class Classification(BaseModel):
    category: str
    confidence: float
    reasoning: str

tools = [
    {
        "name": "classify",
        "description": "Classify the input and return structured data",
        "input_schema": Classification.model_json_schema(),
    }
]

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    tool_choice={"type": "tool", "name": "classify"},
    messages=[{"role": "user", "content": f"Classify this: {text}"}],
)

# Extract tool result
tool_block = next(b for b in message.content if b.type == "tool_use")
result = Classification.model_validate(tool_block.input)
```

### Error Handling (Python)
```python
import anthropic

try:
    message = client.messages.create(...)
except anthropic.RateLimitError:
    # 429 — back off and retry
    pass
except anthropic.APIStatusError as e:
    print(f"API error {e.status_code}: {e.message}")
    raise
```

## Rules
- Always handle errors — API calls fail
- Never hardcode API keys — use `ANTHROPIC_API_KEY` env var
- Specify `max_tokens` explicitly — don't rely on defaults
- For structured output in TS, strip markdown fences before `JSON.parse`
- For structured output in Python, use tool_use with Pydantic schemas
- Use async client (`AsyncAnthropic`) in FastAPI / async contexts
- Log errors with enough context to debug (route name, input summary)
