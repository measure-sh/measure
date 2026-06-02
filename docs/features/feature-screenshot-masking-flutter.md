---
description: "Mask sensitive content in Flutter widgets when Measure captures screenshots."
---

# Screenshot Masking for Flutter

Measure captures screenshots on fatal erros, unhandled errors and bug reports. Before a screenshot leaves the device,
sensitive content is redacted so it does not leak to the server.

On Flutter, masking traverses the widget tree under the `MeasureWidget` and paints over the regions
that match the configured [screenshot mask level](configuration-options.md#screenshot-mask-level).

# Table of Contents

* [**How Flutter Masking Works**](#how-flutter-masking-works)
* [**Mask Levels**](#mask-levels)
* [**Manual Masking**](#manual-masking)
    * [**`MsrMask`**](#msrmask)
* [**Examples**](#examples)

# How Flutter Masking Works

Masking walks the widget tree under the `MeasureWidget` that wraps your app and collects the regions
to redact:

- **Text** — `Text` and `RichText`
- **Input fields** — `TextField` and `EditableText`
- **Images** — `Image`

Whether each region is masked depends on the active mask level. Two details are specific to Flutter:

- **Clickable detection** is best-effort, based on the widget type. Text inside buttons, `InkWell`,
  or a `GestureDetector` with handlers is treated as clickable.
- **Sensitive detection** treats a `TextField` as sensitive when `obscureText` is `true`, or when its
  `keyboardType` is `emailAddress`, `phone`, or `visiblePassword`. Sensitive fields are always
  masked, even at the *all text except clickable* level.

# Mask Levels

The mask level is configured remotely from the dashboard and applies to all platforms. See
[Screenshot Mask Level](configuration-options.md#screenshot-mask-level) for the full list of levels
and what each one redacts.

# Manual Masking

## `MsrMask` Widget

Automatic detection covers standard text, input and image widgets. To always mask anything else,
wrap it with `MsrMask`. The wrapped widget's area is always redacted, regardless of the configured 
mask level.

```dart
MsrMask(
  child: AccountBalance(amount: balance),
)
```
