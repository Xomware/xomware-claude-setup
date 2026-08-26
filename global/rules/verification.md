---
paths:
  - "**/*.html"
  - "**/*.component.ts"
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.swift"
  - "**/*.yml"
  - "**/*.yaml"
---

# Verification Before Pushing

Loads when touching UI, templates, or app-parsed config — the changes unit tests are
worst at covering.

- For UI, rendering, navigation or state-machine changes: walk the flow in the real app
  or a browser BEFORE pushing. State "verified in app" or "did not verify — unit tests
  only" explicitly in the PR description. Both are acceptable; silence is not.
- Green `npm test` / `pytest` is necessary, NOT sufficient. Unit tests don't catch UX
  regressions, layout breakage, duplicated content, or contract drift between a Lambda
  and the client calling it.
- For content and template changes: render the final output. A diff of an Angular
  template or a SwiftUI body is not what the user will see.
- For state-machine changes (status enums, phase states, auth states): manually trace
  every reader of the field. Tests rarely cover all reader paths.
- For a Lambda whose response shape changed: check the caller. A `{ data, error, meta }`
  contract only holds if both ends agree.
- Do NOT ship a PR touching UI, state machines, or content templates without manual
  verification. Green tests are not a feature working.
