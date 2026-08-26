---
paths:
  - "**/*.swift"
  - "**/Sources/**"
  - "**/*.xcodeproj/**"
  - "**/*.xcworkspace/**"
  - "**/Package.swift"
---

# iOS Rules

Non-negotiables. The `ios-standards` skill carries the full Swift/SwiftUI conventions.

- `@Observable`, not `ObservableObject` (iOS 17+).
- Modern SwiftUI APIs: `foregroundStyle()`, `clipShape(.rect())`, `NavigationStack`.
- MVVM: views stay lightweight, logic lives in view models.
- async/await for all async work — no completion handlers.
- No force unwrapping without a documented justification.
- Strict concurrency: resolve the warnings, don't silence them.
- Accessibility: Dynamic Type, VoiceOver labels, 44pt touch targets.

## Design and UX

- 8pt spacing grid — every margin, padding and gap is a multiple of 8.
- Dark-first: build dark mode first, derive light from it.
- Never hard-code font sizes. Dynamic Type text styles only.
- Never show a blank screen. Every data-fetching view needs loading (skeleton), empty
  and error states.
- Press feedback on every tappable element: `.scaleEffect` plus haptic.
- Spring animations for interactive elements, `easeOut` for presentational. Never
  `.linear`.
- `.sensoryFeedback()` for haptics, intensity matched to how important the action is.
- Respect `isReduceMotionEnabled` — always provide a reduced-motion fallback.
