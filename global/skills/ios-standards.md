---
name: ios-standards
description: >
  ALWAYS use when doing any iOS or macOS app work — Swift, SwiftUI, Xcode, UIKit,
  SwiftData, Core Data, SPM packages, or Apple platform development. Covers modern
  Swift 6+ conventions, SwiftUI best practices, and app architecture. Never write
  Swift or SwiftUI without this skill.
  Trigger phrases: "swift", "swiftui", "xcode", "ios", "macos", "uikit",
  "swiftdata", "spm", "apple", "view model", "observable".
---

# iOS / Swift Standards

## Stack

| Layer | Tech |
|---|---|
| Language | Swift 6.0+ with strict concurrency |
| UI | SwiftUI (primary), UIKit only when SwiftUI can't do it |
| Architecture | MVVM with `@Observable` |
| Persistence | SwiftData (preferred), Core Data (legacy) |
| Networking | URLSession + async/await |
| Navigation | NavigationStack + enum-based routing |
| Testing | Swift Testing (`@Test`, `#expect`), XCTest for UI tests |
| Dependencies | Swift Package Manager (SPM) |
| Min deployment | iOS 17.0+ (to use @Observable, SwiftData) |

## Before Writing Code

1. Check the Xcode project structure -- understand targets, schemes, SPM packages
2. Identify the architecture pattern in use (MVVM, TCA, etc.) -- match it
3. Check for existing design system / shared components before creating new ones
4. Confirm deployment target -- this drives which APIs are available

## Architecture -- MVVM with @Observable

```swift
// ViewModel -- use @Observable, not ObservableObject
@Observable
final class ItemListViewModel {
    var items: [Item] = []
    var isLoading = false
    var error: AppError?

    private let service: ItemService

    init(service: ItemService) {
        self.service = service
    }

    func loadItems() async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await service.fetchItems()
        } catch {
            self.error = .network(error)
        }
    }
}

// View -- lightweight, delegates logic to ViewModel
struct ItemListView: View {
    @State private var viewModel: ItemListViewModel

    init(service: ItemService) {
        _viewModel = State(initialValue: ItemListViewModel(service: service))
    }

    var body: some View {
        List(viewModel.items) { item in
            ItemRow(item: item)
        }
        .task { await viewModel.loadItems() }
    }
}
```

## SwiftUI Rules

**Modern APIs -- always use these:**
- `foregroundStyle()` not `foregroundColor()`
- `clipShape(.rect(cornerRadius:))` not `cornerRadius()`
- `overlay(alignment:content:)` not `overlay(_:alignment:)`
- `.topBarLeading/.topBarTrailing` not `.navigationBarLeading/.navigationBarTrailing`
- `.scrollIndicators(.hidden)` not `showsIndicators: false`
- `sensoryFeedback()` not `UIImpactFeedbackGenerator`
- `@Entry` macro for custom environment keys
- `NavigationStack` not `NavigationView`
- `Tab` API not `tabItem()`

**View composition:**
- Extract views exceeding ~100 lines into subviews
- `@State` for local view state only
- `@Environment` for dependency injection
- `@Bindable` for bindings to `@Observable` objects
- Never do heavy work in `init()` or `body`

**Data flow:**
- `@Observable` (not `ObservableObject`) for view models
- `@State` for simple local state
- `@Binding` for parent-child communication
- Async/await for all async operations -- no completion handlers
- Combine only when you need multi-emission streams

**Navigation:**
- `NavigationStack` with enum-based `Route` conforming to `Hashable`
- `navigationDestination(for:)` for type-safe routing
- Parent view models create optional child VMs for sheets (set to `nil` on dismiss)

## Swift Language Rules

- Strict concurrency -- no `@Sendable` workarounds, design for it
- `guard` for early exits -- not nested `if let`
- Value types (structs) over reference types unless shared mutable state needed
- Typed errors conforming to `LocalizedError`
- No force unwrapping (`!`) without documented justification
- Access control on everything -- default to `private`, expose intentionally
- One type per file, organized by feature not by type
- Doc comments on all public API

## Anti-Patterns (never ship)

- `ObservableObject` when `@Observable` is available (iOS 17+)
- `NavigationView` -- always `NavigationStack` or `NavigationSplitView`
- Force unwrapping without comment
- Massive views (200+ lines with logic mixed in)
- GeometryReader when `containerRelativeFrame()` or `visualEffect()` works
- Completion handlers when async/await is possible
- Third-party dependencies without explicit justification
- `Text` concatenation with `+` -- use interpolation

## Accessibility Checklist

- [ ] Dynamic Type supported -- no fixed font sizes
- [ ] VoiceOver labels on all interactive elements
- [ ] Touch targets >= 44x44pt
- [ ] `accessibilityLabel` / `accessibilityHint` where needed
- [ ] Respects `Reduce Motion` preference
- [ ] Color not sole state differentiator
- [ ] Logical focus order

## Self-Review

Before marking iOS work done:
- [ ] No deprecated APIs (check list above)
- [ ] Architecture matches project pattern (MVVM/@Observable)
- [ ] All views under ~100 lines
- [ ] Strict concurrency -- no warnings
- [ ] Accessibility checklist passed
- [ ] No force unwraps without justification
- [ ] Tests: view model logic covered
- [ ] Builds and runs clean in Xcode
