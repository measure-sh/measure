# Feature - Navigation & Lifecycle

Measure SDK captures lifecycle and navigation events automatically, this includes the following:

1. [Application lifecycle](#application-lifecycle)
2. [View Controller lifecycle](#view-controller-lifecycle)
3. [SwiftUI lifecycle](#swiftui-lifecycle)

## Application lifecycle

Measure automatically tracks the following Application lifecycle events:

1. Background
2. Foreground
3. Terminated

### How it works

Measure SDK listens for system notifications to track application lifecycle events. It uses [didEnterBackgroundNotification](https://developer.apple.com/documentation/uikit/uiapplication/didenterbackgroundnotification) to detect when the app moves to the background, [willEnterForegroundNotification](https://developer.apple.com/documentation/uikit/uiapplication/willenterforegroundnotification) when the app returns to the foreground, and [willTerminateNotification](https://developer.apple.com/documentation/uikit/uiapplication/willterminatenotification) to capture when the app is about to be terminated. These notifications enable Measure to accurately record app state transitions.

### Data collected

Checkout all the data collected for App lifecycle in the [App Lifecycle Event](../../api/sdk/README.md#lifecycle_app) section.

## View Controller lifecycle

Measure automatically tracks the following View Controller lifecycle events:

1. viewDidLoad
2. viewWillAppear
3. viewDidAppear
4. viewWillDisappear
5. viewDidDisappear
6. didReceiveMemoryWarning
7. initWithNibName
8. initWithCoder

You can also track `loadView` and `deinit`/`dealloc` by inheriting from `MsrViewController` for swift and `MSRViewController` for ObjC.

### How it works

Measure SDK uses method swizzling to intercept View Controller lifecycle methods. This technique dynamically replaces method implementations at runtime, allowing Measure to capture lifecycle events without requiring manual integration.

### Example Usage

#### Swift

```swift
   class ViewController: MsrViewController {
     ...
   }
```

#### Objective-C

```objc
   @interface ObjcDetailViewController: MSRViewController
    ...
   @end
```

### Data collected

Checkout all the data collected for View Controller lifecycle in the [View Controller Lifecycle Event](../../api/sdk/README.md#lifecycle_view_controller) section.

## SwiftUI lifecycle

Measure can track SwiftUI component's `onAppear` and `onDisappear` if you wrap your view with the `MsrMoniterView`.

### How it works

Measure SDK provides `MsrMoniterView`, a wrapper view that listens for SwiftUI lifecycle events. The `MsrMoniterView` ensures that each appearance event is only triggered once per lifecycle instance. Additionally, you can use the `moniterWithMsr` extension to conveniently wrap any SwiftUI view.

### Example Usage

#### Using `MsrMoniterView`

```swift
struct ContentView: View {
    var body: some View {
        MsrMoniterView("ContentView") {
            Text("Hello, World!")
        }
    }
}
```

#### Using `moniterWithMsr`

```swift
struct ContentView: View {
    var body: some View {
        Text("Hello, World!")
            .moniterWithMsr("ContentView")
    }
}
```

## Data collected

Checkout all the data collected for SwiftUI lifecycle in the [SwiftUI Lifecycle Event](../../api/sdk/README.md#lifecycle_swift_ui) section.
