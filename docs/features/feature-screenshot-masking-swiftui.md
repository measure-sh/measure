---
description: "Mask sensitive content in SwiftUI views when Measure captures screenshots."
---

# Screenshot Masking for SwiftUI

Measure's screenshot masking works by traversing the UIKit view hierarchy to identify and redact
sensitive views. Because SwiftUI renders its views differently from UIKit, the standard masking
configuration options behave differently in SwiftUI contexts.

To manage masking in SwiftUI, Measure provides the `.msrMask()` and `.msrUnmask()` view modifiers.

# Table of Contents

* [**How SwiftUI Masking Works**](#how-swiftui-masking-works)
* [**Manual Masking**](#manual-masking)
    * [**`.msrMask()`**](#msrmask)
    * [**`.msrUnmask()`**](#msrunmask)
* [**Examples**](#examples)
    * [**Masking a standalone Text view**](#masking-a-standalone-text-view)
    * [**Unmasking content inside a SwiftUI screen**](#unmasking-content-inside-a-swiftui-screen)
    * [**Mixed masking in a form**](#mixed-masking-in-a-form)

# How SwiftUI Masking Works

In UIKit, every visible element on screen corresponds to a `UIView` instance in the view hierarchy.
Measure's masking traverses this hierarchy and redacts views that match known sensitive types such
as `UILabel`, `UITextField` and `UITextView`.

SwiftUI does not follow this pattern. Most SwiftUI views do not produce individual `UIView` instances.
Instead, the entire SwiftUI view tree is hosted inside a `_UIHostingView`, which renders its content
directly without creating UIKit counterparts for each view.

As a result, **Measure masks the entire `_UIHostingView` frame by default** when a SwiftUI screen
is present. This is the safest default — it ensures no SwiftUI content leaks into screenshots —
but it means all SwiftUI content is masked, including content that may not be sensitive.

Use `.msrUnmask()` to selectively expose content that is safe to show, and `.msrMask()` to
explicitly mask content that needs to be hidden.

# Manual Masking

## `.msrMask()`

Marks a SwiftUI view as sensitive. The view's frame will be redacted in screenshots regardless of
whether it would be detected automatically.

Use this for:

- Standalone `Text` views containing sensitive data outside of `List` contexts
- Any custom SwiftUI view containing sensitive content that is not automatically detected

```swift
Text(userEmail)
    .msrMask()
```

## `.msrUnmask()`

Exempts a SwiftUI view from masking. Use this to opt specific views out of the blanket
`_UIHostingView` masking that is applied by default.

When `.msrUnmask()` is applied to a view, its frame is subtracted from the masked region. This
means content behind the unmasked view will also become visible in the screenshot.

Use this for:

- Non-sensitive SwiftUI content you want to remain visible in screenshots
- Structural views like navigation titles, icons or static labels that contain no user data

```swift
Text("Welcome back")
    .msrUnmask()
```

> [!NOTE]
> `.msrUnmask()` takes precedence over automatic masking for the specific view it is applied to.
> It does not affect sibling or parent views.

# Examples

## Masking a standalone Text view

By default, `Text` views outside a `List` are not automatically detected. Use `.msrMask()` to
ensure they are redacted.

```swift
var body: some View {
    VStack {
        Text("Account balance")       // not sensitive, no modifier needed
        Text("\(user.balance)")        // sensitive — mask explicitly
            .msrMask()
    }
}
```

## Unmasking content inside a SwiftUI screen

Because all SwiftUI content is masked by default via `_UIHostingView`, use `.msrUnmask()` to
expose non-sensitive content.

```swift
var body: some View {
    VStack {
        Text("Hello, \(user.name)")   // sensitive — remains masked by default
        Image(systemName: "star")     // not sensitive — unmask explicitly
            .msrUnmask()
    }
}
```

## Mixed masking in a form

In a form with both sensitive and non-sensitive fields, use both modifiers together.

```swift
var body: some View {
    Form {
        Section("Profile") {
            Text("Username")          // label — unmask
                .msrUnmask()
            TextField("Username", text: $username)
                                      // UITextField — masked automatically
        }
        Section("Security") {
            Text("Password")          // label — unmask
                .msrUnmask()
            SecureField("Password", text: $password)
                                      // UITextField — masked automatically
            Text(sensitiveHint)       // sensitive Text — mask explicitly
                .msrMask()
        }
    }
}
```

> [!WARNING]
> Do not use `.msrUnmask()` on views that contain or overlap sensitive content. The unmasked
> frame is subtracted from the masked region, which means any sensitive content behind it will
> also become visible in the screenshot.