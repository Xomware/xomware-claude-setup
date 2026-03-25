---
name: ts-component
description: >
  ALWAYS use when creating or refactoring a React/TypeScript component. Produces
  properly typed, structured components following Xomware code standards. Also triggers
  for: component props, hooks, state management, or component composition patterns.
  Trigger phrases: "component", "tsx", "react component", "props", "hooks",
  "useState", "useEffect", "functional component".
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

## Xomware UI Notes
- Use Xomware brand colors via CSS variables
- Tailwind: no `bg-white` — always `bg-[#FCFCF2]` (Ivory)
- No rounded corners — `rounded-none`
- Import shadcn/ui components when available before building from scratch
