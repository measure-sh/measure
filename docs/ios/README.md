# Measure iOS SDK

* [Minimum requirements](#minimum-requirements)
* [Quick reference](#quick-reference)
* [Getting started](#getting-started)
* [Manually start or stop the SDK](#manually-start-or-stop-the-sdk)
* [Configuration options](#configuration-options)
* [Features](#features)
  * [Automatic collection](#automatic-collection)
  * [Crash Reporting](#crash-reporting)
  * [Identify users](#identify-users)
  * [Custom events](#custom-events)
  * [ScreenView](#screen-view)
  * [SwiftUI Lifecycle](#swiftui-lifecycle)
  * [ViewController Lifecycle](#viewcontroller-lifecycle)
  * [Network Monitoring](#network-monitoring)
  * [Performance Tracing](#performance-tracing)
* [Session](#session)

# Minimum requirements

| Name                          | Version       |
|-------------------------------|---------------|
| Xcode                         |     15.0+     |
| Minimum iOS Deployments       |     12.0+     |
| Swift Version                 |     5.10+     |

## Self-host compatibility

Before integrating iOS SDK, make sure the deployed self-host version is **atleast 0.6.0**. For more 
details, checkout the [self-host guide](../hosting/README.md).

| SDK version   | Minimum required self-host version |
|---------------|------------------------------------|
| 0.1.0         | 0.6.0                              |
 
# Getting started

Once you have access to the dashboard, create a new app and follow the steps below:

### 1. Install Measure SDK

Measure SDK supports **CocoaPods** and **Swift Package Manager (SPM)** for installation.

#### Using CocoaPods

[CocoaPods](https://cocoapods.org) is a dependency manager for Cocoa projects. For usage and installation instructions, visit their website. To integrate MeasureSDK into your Xcode project using CocoaPods, specify it in your `Podfile`:

```ruby
pod 'measure-sh'
```
#### Using Swift Package Manager

The [Swift Package Manager](https://swift.org/package-manager/) is a tool for automating the distribution of Swift code and is integrated into the `swift` compiler.

Add Measure as a dependency by adding `dependencies` value to your `Package.swift` or the Package list in Xcode.

```swift
dependencies: [
    .package(url: "https://github.com/measure-sh/measure.git", branch: "ios-v0.2.0")
]
```

### 2. Initialize the SDK

Add the following to your AppDelegate's `application(_:didFinishLaunchingWithOptions:)` to capture early crashes and launch time metrics.

> [!IMPORTANT]
> To detect early crashes and ensure accurate launch time metrics,
> initialize the SDK as soon as possible in `application(_:didFinishLaunchingWithOptions:)`.

```swift
import MeasureSDK

func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let config = BaseMeasureConfig()
    let clientInfo = ClientInfo(apiKey: "<apiKey>", apiUrl: "<apiUrl>")
    Measure.shared.initialize(with: clientInfo, config: config)
    return true
}
```

```objc
#import <MeasureSDK/MeasureSDK.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    BaseMeasureConfig *config = [[BaseMeasureConfig alloc] init];
    ClientInfo *clientInfo = [[ClientInfo alloc] initWithApiKey:@"<apiKey>" apiUrl:@"<apiUrl>"];
    [[Measure shared] initializeWith:clientInfo config:config];
    return YES;
}

```

### 3. Verify

The SDK automatically collects data when a crash occurs. You can verify if the SDK is working by triggering a test event or a crash after initializing the SDK.

To verify crash reporting, trigger a crash in your application:

Reopen the app and check the Measure dashboard—you should see the crash report.

> [!CAUTION]  
> Make sure to **remove the test crash code** before releasing the app to production.

> [!IMPORTANT]  
> When triggering a crash, **make sure the Xcode debugger is not attached**, as crashes may not be properly reported when running the app in debug mode.

🎉 Congratulations! You have successfully integrated Measure into your app!

# Manually start or stop the SDK

By default, `Measure.shared.initialize` starts collection of events. To delay start to a different point in your app use [*autostart* configuration options](configuration-options.md#autostart). This can be used to control the scope of where Measure is active in your application.

```swift
let config = BaseMeasureConfig(autoStart: false) // delay starting of collection
let clientInfo = ClientInfo(apiKey: "<apiKey>", apiUrl: "<apiUrl>")
Measure.shared.initialize(with: clientInfo, config: config)

// Start collecting
Measure.shared.start()

// Stop collecting
Measure.shared.stop()
```

> [!IMPORTANT]
> Some SDK instrumentation remains active even when stopped. This is to maintain state and ensure seamless data collection when it is started.
> Additionally, cold, warm & hot launch events are also always captured. However, no data is sent to the server until the SDK is started.

# Configuration options

See all the [configuration options](configuration-options.md) available.

# Features

Measure SDK operates on an event-based architecture, automatically collecting key debugging events while letting you track custom events, screen views and layout snapshots, etc. Read along for more details.

## Automatic collection

The following data is automatically collected by Measure. Read the individual docs for more details.

* [App launch](/docs/ios/features/feature_app_launch.md)
* [Crash tracking](/docs/ios/features/feature_crash_tracking.md)
* [Network monitoring](/docs/ios/features/feature_network_monitoring.md)
* [Network changes](/docs/ios/features/feature_network_changes.md)
* [Gesture tracking](/docs/ios/features/feature_gesture_tracking.md)
* [Layout Snapshots](/docs/ios/features/feature_layout_snapshots.md)
* [Navigation & Lifecycle](/docs/ios/features/feature_navigation_and_lifecycle.md)
* [CPU monitoring](/docs/ios/features/feature_cpu_monitoring.md)
* [Memory monitoring](/docs/ios/features/feature_memory_monitoring.md)
* [Performance Tracing](/docs/ios/features/feature_performance_tracing.md)
* [Screen Load Time](/docs/ios/features/feature_screen_load_time.md)

## Crash Reporting  

MeasureSDK automatically detects and exports crashes. To symbolicate these crashes, DSYM files need to be uploaded to the server. You can upload DSYM files using a standalone shell script or via Xcode’s Build Phases.  

### Using Shell Script  

Run the [`upload_dsyms.sh`](../../ios/Scripts/upload_dsyms.sh) script to manually upload DSYM files after building your app.  

```sh
sh upload_dsyms.sh <path_to_ipa> <path_to_dsym_folder> <api_url> <api_key>
```

### Using Build Phases  

Add the [`upload_dsym_build_phases.sh`](../../ios/Scripts/upload_dsym_build_phases.sh) script as a **New Run Script Phase** in Xcode to upload DSYM files automatically.  

```sh
sh "${SRCROOT}/path/to/upload_dsym_build_phases.sh" <api_url> <api_key>
```

> [!CAUTION]  
> If you are using Build Phases to upload DSYMs make sure to **upload DSYMs only for release builds**.

## Identify users

Correlating sessions with users is critical for debugging certain issues. Measure allows setting a user ID which can
then be used to query sessions and events on the dashboard. User ID is persisted across app launches.

```swift
Measure.shared.setUserId("user_id")
```

```objc
[[Measure shared] setUserId:@"user_id"]
```

To clear a user ID. 

```swift
Measure.shared.clearUserId()
```

```objc
[[Measure shared] clearUserId]
```

## Custom Events

Custom events provide more context on top of automatically collected events. They provide the context specific to the app to debug issues and analyze impact.

To track a custom event, use the `trackEvent` method:

```swift
Measure.shared.trackEvent(name: "event_name")
```

```objc
[[Measure shared] trackEvent:@"event_name"];
```

A custom event can also contain attributes, which are key-value pairs:

- Attribute keys must be **strings** with a maximum length of **64 characters**.
- Attribute values must be one of the supported types: **string, integer, float, double, or boolean**.
- String attribute values can have a maximum length of **256 characters**.

```swift
Measure.shared.trackEvent(name: "event_name", attributes: ["is_premium_user": .bool(true)])
```

```objc
[[Measure shared] trackEvent:@"event_name" attributes:@{@"is_premium_user": YES}];
```

If an event occurred before the SDK was initialized, you can track it with a custom timestamp. The timestamp must be in **milliseconds since epoch**.

```swift
Measure.shared.trackEvent(name: "event_name", timestamp: 1734443973879)
```
```objc
[[Measure shared] trackEvent:@"event_name" timestamp:1734443973879];
```

Apart from sending custom events, the following event can be tracked with a predefined schema:

- [ScreenView](#screen-view)
- [SwiftUI Lifecycle](#swiftui-lifecycle)
- [ViewController Lifecycle](#viewcontroller-lifecycle)
- [Network Monitoring](#network-monitoring)


## Screen View

Measure SDK automatically tracks view controller [lifecycle events](../docs/ios/features/feature_navigation_and_lifecycle.md). However, if your app uses a custom navigation system, you can manually trigger `screen_view` events to track user flow.

To track a screen view manually, use the following method:

```swift
Measure.shared.trackScreenView("Home")
```
```objc
[[Measure shared] trackScreenView:@"Home"];
```

## SwiftUI Lifecycle

Measure can track SwiftUI component's `onAppear` and `onDisappear` if you wrap your view with the `MsrMoniterView`. Measure also provides an extension function on View that wraps the view in an `MsrMoniterView` to monitor its lifecycle events.

To track SwiftUI lifecycle events, you can use the following methods:

### Using `MsrMoniterView`

```swift
struct ContentView: View {
    var body: some View {
        MsrMoniterView("ContentView") {
            Text("Hello, World!")
        }
    }
}
```

### Using `moniterWithMsr`

```swift
struct ContentView: View {
    var body: some View {
        Text("Hello, World!")
            .moniterWithMsr("ContentView")
    }
}
```

## ViewController Lifecycle

Measure automatically tracks the following View Controller lifecycle events:

1. viewDidLoad
2. viewWillAppear
3. viewDidAppear
4. viewWillDisappear
5. viewDidDisappear
6. didReceiveMemoryWarning
7. initWithNibName
8. initWithCoder

You can also track `loadView` and `deinit`/`dealloc` by inheriting from **`MsrViewController` for swift and `MSRViewController` for Objective-C**.

```swift
   class ViewController: MsrViewController {
     ...
   }
```

```objc
   @interface ObjcDetailViewController: MSRViewController
    ...
   @end
```

## Network Monitoring

Measure SDK automatically monitors all API calls happening in the app. You can view the collected HTTP data [here](../docs/api/sdk/README.md#http).  
This is achieved by swizzling `NSURLSessionTask`'s `setState:` method. However, there is one limitation: **response bodies cannot be tracked** using this method.  

If you also want to track response bodies, you can use `MSRNetworkInterceptor`.  
The `MSRNetworkInterceptor` modifies the provided `URLSessionConfiguration` to inject the `NetworkInterceptorProtocol` into its `protocolClasses`.  

If the interceptor is already enabled, subsequent calls to this method will have no effect.  
  
```swift
  let config = URLSessionConfiguration.default
  MSRNetworkInterceptor.enable(on: config)
  let session = URLSession(configuration: config)
```

```objc
  NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
  [MSRNetworkInterceptor enableOn:config];
  NSURLSession *session = [NSURLSession sessionWithConfiguration:config];
```

> [!Note]
> Ensure you call this method before creating a `URLSession` instance with the given configuration.

## Performance Tracing

Performance tracing allows you to measure the time taken by specific operations in your app, providing insights into performance bottlenecks. It uses **traces** and **spans** to track operations and their relationships.

### Key Concepts
- **Trace**: Represents an entire operation, such as a user journey, identified by a `traceId`.
- **Span**: Represents a single unit of work within a trace, such as an HTTP request or database query, identified by a `spanId`.

### Example Usage

#### Start a Span
You can start a span using the `startSpan` API:

```swift
let span: Span = Measure.shared.startSpan(name: "operation-name")
```

#### End a Span
End the span and set its status:

```swift
span.setStatus(.ok).end()
```

#### Start a Span with a Custom Timestamp
If the operation has already started, you can provide a custom start time:

```swift
let span: Span = Measure.shared.startSpan(name: "operation-name", timestamp: Measure.shared.getCurrentTime())
```

### Learn More
For detailed documentation, including advanced usage and distributed tracing, refer to the [Performance Tracing Documentation](/docs/ios/features/feature_performance_tracing.md).

# Session

A session represents a continuous period of activity in the app. A new session begins when an app is launched for the first time,
or when there's been no activity for a 20-minute period. A single session can continue across multiple app background and
foreground events; brief interruptions will not cause a new session to be created. This approach is helpful when reviewing
session replays, as it shows the app switching between background and foreground states within the same session.

The current session can be retrived by using `getSessionId` method.

```swift
let sessionId = Measure.shared.getSessionId()
```
```objc
NSString *sessionId = [[Measure shared] getSessionId];
```