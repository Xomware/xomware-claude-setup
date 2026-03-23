---
name: ts-component
description: Use when creating a new React/TypeScript component. Produces a properly typed, structured component following Areté's code standards.
---

# TypeScript React Component

## Template

```tsx
// [ComponentName].tsx
import { type FC } from "react";

interface [ComponentName]Props {
  // props here
}

export const [ComponentName]: FC<[ComponentName]Props> = ({ ...props }) => {
  return (
    <div>
      {/* content */}
    </div>
  );
};
```

## Rules
- Named exports only — no default exports
- Explicit prop types via interface, not inline
- `FC<Props>` typing on the component
- Co-locate types with the component unless shared
- File name = component name (PascalCase)
- One component per file (small helpers OK in same file)
- No `any` — type everything or use `unknown` + guard

## File Structure
```
components/
  [ComponentName]/
    index.ts          ← re-export
    [ComponentName].tsx
    [ComponentName].test.tsx   ← if adding tests
```

## Areté UI Notes
- Use Areté brand colors via CSS variables (see arete-brand skill)
- Tailwind: no `bg-white` — always `bg-[#FCFCF2]` (Ivory)
- No rounded corners — `rounded-none`
- Import shadcn/ui components when available before building from scratch
