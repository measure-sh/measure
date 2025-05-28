# Bug Reports — iOS

Bug reports enable users to report issues directly from the app. There are two ways to use the bug reporting feature:

1. **Built-in Experience**: Use the default bug report interface provided by the SDK.
2. **Custom Experience**: Build a custom bug reporting UI and use the SDK to track bug reports programmatically.

Additionally, the SDK supports using shake gestures to launch the bug reporting flow, allowing users to report bugs quickly and easily without having to navigate through the app.

* [**Built-in Experience**](#built-in-experience)
* [**Theming**](#theming)
* [**Custom Experience**](#custom-experience)
* [**Add Attributes**](#add-attributes)
* [**Shake to Report Bug**](#shake-to-report-bug)

## Built-in Experience

Launch the default bug report interface using `Measure.shared.launchBugReport`. A screenshot can be automatically taken and added to the bug report. Users can remove or add more attachments in the UI.

| Dark Mode                                    | Light Mode                                     |
|----------------------------------------------|------------------------------------------------|
| ![Dark Mode](assets/ios-bug-report-dark.png) | ![Light Mode](assets/ios-bug-report-light.png) |

When the screenshot button is clicked, a floating screenshot and exit button appear. Users can traverse through the app and take screenshots of the relevant screen.

[Bug Report demo](https://github.com/user-attachments/assets/491e685b-e1ae-4c8d-ac36-8f42d73fa3eb)

### Example Usage

```swift
Measure.shared.launchBugReport(takeScreenshot: true)
```

To disable taking a screenshot when launching, set `takeScreenshot: false`:

```swift
Measure.shared.launchBugReport(takeScreenshot: false)
```

You can also pass a custom UI config and attributes:

```swift
let color = BugReportConfig.default.colors.update(isDarkMode: false)
let config = BugReportConfig(colors: color)
let attributes: [String: AttributeValue] = ["user_id": .string("12345")]
Measure.shared.launchBugReport(takeScreenshot: true, bugReportConfig: config, attributes: attributes)
```

Currently, you can have a maximum of 5 attachments and a description length of 4000 characters.

### Theming

You can customize the appearance of the bug report UI using `BugReportConfig`. To set the theme, update the colors using `.update(isDarkMode: ...)` and pass the result to the `BugReportConfig` initializer.

Check out [BugReportConfig](../../ios/Sources/MeasureSDK/Swift/BugReport/BugReportConfig/) to see all the configurable tokens.

### Example Usage

```swift
let color = BugReportConfig.default.colors.update(isDarkMode: false)
let dimensions = MsrDimensions(
    topPadding: 20
)
let config = BugReportConfig(colors: color, dimensions: dimensions)
Measure.shared.launchBugReport(takeScreenshot: true, bugReportConfig: config)
```

## Custom Experience

You can build a custom bug reporting UI and use the SDK to track bug reports programmatically.

### Example Usage

```swift
let screenshot = Measure.shared.captureScreenshot(for: viewController)
let layoutSnapshot = Measure.shared.captureLayoutSnapshot(from: viewController)
Measure.shared.trackBugReport(
    description: "Items from cart disappear after reopening the app",
    attachments: [screenshot, layoutSnapshot].compactMap { $0 },
    attributes: ["is_premium": .bool(true)]
)
```

### Attachments

Bug reports can include up to 5 attachments (screenshots or layout snapshots).

### Example Usage

```swift
if let screenshot = Measure.shared.captureScreenshot(for: viewController) {
    Measure.shared.trackBugReport(description: "Bug description", attachments: [screenshot], attributes: nil)
}
```

```swift
if let snapshot = Measure.shared.captureLayoutSnapshot(from: viewController) {
    Measure.shared.trackBugReport(description: "Bug description", attachments: [snapshot], attributes: nil)
}
```

## Add Attributes

You can attach additional contextual data to bug reports, such as user state or app configuration.

### Example Usage

```swift
let attributes: [String: AttributeValue] = [
    "is_premium_user": .bool(true),
    "user_id": .string("12345")
]
Measure.shared.launchBugReport(attributes: attributes)
```

Or with custom bug reports:

```swift
Measure.shared.trackBugReport(description: "Bug description", attachments: [], attributes: attributes)
```

## Shake to Report Bug

Enable shake-to-report to allow users to launch the bug reporting flow by shaking their device.

### Enable Shake to Launch

```swift
Measure.shared.enableShakeToLaunchBugReport(takeScreenshot: true)
```

### Disable Shake to Launch

```swift
Measure.shared.disableShakeToLaunchBugReport()
```

### Check if Shake-to-Launch is Enabled

```swift
let enabled = Measure.shared.isShakeToLaunchBugReportEnabled()
```

### Manually Handle Shake Gestures

```swift
Measure.shared.setShakeListener(MyShakeListener())
// Implement MsrShakeListener protocol in MyShakeListener```
```