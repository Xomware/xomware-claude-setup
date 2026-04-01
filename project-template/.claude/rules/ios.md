---
paths:
  - "*.swift"
  - "Sources/**"
  - "*.xcodeproj/**"
  - "*.xcworkspace/**"
---
# iOS Rules

- Check `ios-standards` skill for full Swift/SwiftUI conventions
- Use `@Observable` not `ObservableObject` (iOS 17+)
- Modern SwiftUI APIs: `foregroundStyle()`, `clipShape(.rect())`, `NavigationStack`
- MVVM: views are lightweight, logic lives in view models
- Async/await for all async work -- no completion handlers
- Accessibility: Dynamic Type, VoiceOver labels, 44pt touch targets
- No force unwrapping without documented justification
- Strict concurrency -- resolve all warnings

## Design & UX
- 8pt spacing grid -- all margins, padding, gaps are multiples of 8
- Dark-first design -- build dark mode first, derive light from it
- Never hard-code font sizes -- use Dynamic Type text styles exclusively
- Never show blank screens -- every data-fetching view needs loading (skeleton), empty, and error states
- Button press feedback on all tappable elements -- `.scaleEffect` + haptic
- Spring animations for interactive elements, `easeOut` for presentational -- never `.linear`
- Use `.sensoryFeedback()` for haptics -- match intensity to action importance
- Respect `isReduceMotionEnabled` -- always provide reduced-motion fallbacks
