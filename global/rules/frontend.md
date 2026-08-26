---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.component.ts"
  - "**/*.component.html"
  - "**/*.css"
  - "**/*.scss"
  - "**/components/**"
  - "**/src/app/**"
  - "**/tailwind.config.*"
---

# Frontend Rules

Non-negotiables. The `frontend-standards` skill carries the full conventions, and
`angular-component` carries the Angular component shape.

- Angular is the default across Xomify, Xomper, Xomcloud and xomware.com: standalone
  components, signals, the new control flow (`@if` / `@for`), typed reactive forms,
  `inject()`, OnPush change detection.
- Where a project uses React/Next instead: Server Components by default, `"use client"`
  only when state, effects or browser APIs demand it. shadcn/ui primitives before
  custom components.
- No `any`. TypeScript strict everywhere.
- All interactive states covered: default, hover, focus, active, disabled, loading,
  error, empty. Never ship a data-fetching view with no loading and no error state.
- Accessibility is not optional: semantic HTML, `<label>` on every input, visible focus
  rings, keyboard navigation.
- Named exports over default exports unless the framework forces otherwise.
- Run the project's lint and test commands after changes.
