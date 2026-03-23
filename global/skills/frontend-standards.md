---
name: frontend-standards
description: >
  Use when doing any frontend work -- React, Next.js, Tailwind, shadcn/ui,
  UI components, design systems, accessibility, performance. Covers frontend
  conventions and quality standards. Load alongside ts-component for
  implementation patterns.
---

# Frontend Standards

## Design System Persistence

Before writing any frontend code on an existing project:
1. Check for `.interface-design/system.md` or design tokens file -- if found, read it and state what you see
2. If missing, scan 2-3 existing components to extract actual patterns in use
3. Read `## Frontend Standards` or `## Stack` in project CLAUDE.md
4. State before proceeding: "Found system.md -- [grid, colors, borders]. I'll match that."

New project: establish design tokens first, commit to git.

## Build Rules

**Component Architecture**
- Server Components by default -- `"use client"` only when state/effects/browser APIs needed
- Functional components + hooks -- no class components
- Named exports only (unless framework requires default)
- One component per file (small helpers OK in same file)
- Props via interface, not inline types

**TypeScript**
- `strict: true` -- no `any` without explicit justification
- Type all props, return types on non-trivial functions
- `unknown` + type guard over `any`
- Discriminated unions for variant states

**Tailwind / shadcn**
- Utility-first -- no custom CSS unless Tailwind can't express it
- `cn()` helper for conditional classes
- shadcn/ui primitives before building custom components
- CSS variables for design tokens -- no hardcoded hex in components
- 8px grid for spacing -- no magic pixel values

**Typography**
- Clear hierarchy: Display > Heading > Body > Caption (visibly different)
- Body line-height 1.5-1.6 | Heading 1.1-1.2
- `font-display: swap` always
- Never use Inter, Roboto, Arial as primary without explicit choice

**Color**
- CSS variables only -- `var(--color-primary)` not `#3b82f6`
- Tinted neutrals -- never pure `#000` or `#fff`
- No gray text on colored backgrounds -- use darker shade of bg color
- Contrast: 4.5:1 body | 3:1 large text and UI components

**States -- all of them, every time**
- Interactive: default, hover, focus, active, disabled
- Focus rings: visible, on-brand (not browser default)
- Empty, error, loading: designed, not blank divs
- `prefers-reduced-motion: reduce` -> `transition: none`

## Anti-Patterns (never ship)

- Pure #000/#fff -- tint all neutrals
- Gray text on colored background
- Cards nested in cards nested in cards
- Neon accents on dark bg
- Centered hero + 3-col features + gradient headline (cliche layout)
- Every CTA as primary-blue rounded pill
- Placeholder-only inputs (no `<label>`)
- `role="button"` on `<div>` -- use `<button>`

**The slop test:** Would someone immediately believe "AI made this"? If yes -- not done.

## Accessibility Checklist

- [ ] Images: `alt` text or `alt=""` for decorative
- [ ] Inputs: `<label>` (not placeholder-only)
- [ ] Logical tab order | Visible focus rings
- [ ] No `role="button"` on `<div>` -- use semantic HTML
- [ ] Color not sole state differentiator
- [ ] `aria-live` on dynamic content
- [ ] Touch targets >= 44x44px
- [ ] WCAG AA: 4.5:1 body, 3:1 UI

## Performance Checklist

- [ ] No unnecessary re-renders (memo where measured)
- [ ] Images sized + lazy-loaded
- [ ] No request waterfalls
- [ ] LCP < 2.5s | CLS < 0.1 | INP < 200ms

## Self-Review

Before marking frontend work done:
- [ ] Matches existing design system (system.md or scanned patterns)
- [ ] All interactive states implemented
- [ ] Accessibility checklist passed
- [ ] No anti-patterns present
- [ ] TypeScript strict -- no `any`
- [ ] Responsive (mobile-first if applicable)
