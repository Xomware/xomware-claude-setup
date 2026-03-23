---
name: api-route
description: Use when creating a new Next.js API route or server action. Produces properly structured, typed, and error-handled route handlers.
---

# Next.js API Route

## App Router Route Handler Template

```ts
// app/api/[route]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  // define expected shape
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // --- business logic here ---

    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error("[route-name] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Rules
- Always validate input with zod — no raw `req.json()` directly into logic
- Always return typed `NextResponse.json()` — never `res.send()`
- Always catch errors — log them with route context (`[route-name] error:`)
- 400 for client errors, 500 for server errors — be precise
- No business logic in the route file — call service functions
- Name the file `route.ts` inside the feature folder, not `[feature].ts`

## Server Actions (alternative)
```ts
// actions/[action-name].ts
"use server";

import { z } from "zod";

const Schema = z.object({ /* ... */ });

export async function actionName(input: unknown) {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid input");

  // logic here
  return { success: true };
}
```
