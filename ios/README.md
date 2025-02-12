# Measure iOS SDK

* [Minimum requirements](#minimum-requirements)
* [Self host compatibility](#self-host-compatibility)
* [Quick reference](#quick-reference)
* [Getting started](#getting-started)
* [Custom events](#custom-events)
  * [Screen view](#screen-view)
* [Features](#features)
* [Session](#session)

# Minimum requirements

| Name                          | Version       |
|-------------------------------|---------------|
| Xcode                         |     15.0+     |
| Minimum iOS Deployments       |     12.0+     |
| Swift Version                 |     5.10+     |
 
# Getting started

Once you have access to the dashboard, create a new app and follow the steps below:

### 1. Install Measure SDK

Measure SDK supports **CocoaPods** and **Swift Package Manager (SPM)** for installation.

#### Using CocoaPods

[CocoaPods](https://cocoapods.org) is a dependency manager for Cocoa projects. For usage and installation instructions, visit their website. To integrate MeasureSDK into your Xcode project using CocoaPods, specify it in your `Podfile`:

```ruby
pod 'MeasureSDK'
```
#### Using Swift Package Manager

The [Swift Package Manager](https://swift.org/package-manager/) is a tool for automating the distribution of Swift code and is integrated into the `swift` compiler.

Add Measure as a dependency by adding `dependencies` value to your `Package.swift` or the Package list in Xcode.

```swift
dependencies: [
    .package(url: "https://github.com/measure-sh/measure.git", .upToNextMajor(from: "0.0.1"))
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

# Custom Events

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
[[Measure shared] trackEvent:@"event_name" attributes:@{@"is_premium_user": @YES}];
```

If an event occurred before the SDK was initialized, you can track it with a custom timestamp. The timestamp must be in **milliseconds since epoch**.

```swift
Measure.shared.trackEvent(name: "event_name", timestamp: 1734443973879)
```
```objc
[[Measure shared] trackEvent:@"event_name" timestamp:@(1734443973879)];
```

Apart from sending custom events, the following event can be tracked with a predefined schema:

- [ScreenView](#screen-view)


### Screen View

Measure SDK automatically tracks view controller [lifecycle events](../docs/ios/features/feature_navigation_and_lifecycle.md). However, if your app uses a custom navigation system, you can manually trigger `screen_view` events to track user flow.

To track a screen view manually, use the following method:

```swift
Measure.shared.trackScreenView("Home")
```
```objc
[[Measure shared] trackScreenView:@"Home"];
```

# Features

* [Crash tracking](../docs/ios/features/feature_crash_tracking.md)
* [Network monitoring](../docs/ios/features/feature_network_monitoring.md)
* [Network changes](../docs/ios/features/feature_network_changes.md)
* [Gesture tracking](../docs/ios/features/feature_gesture_tracking.md)
* [Layout Snapshots](../docs/ios/features/feature_layout_snapshots.md)
* [Navigation & Lifecycle](../docs/ios/features/feature_navigation_and_lifecycle.md)
* [App Lifecycle](../docs/ios/features/feature_app_lifecycle.md)
* [App launch](../docs/ios/features/feature_app_launch.md)
* [CPU monitoring](../docs/ios/features/feature_cpu_monitoring.md)
* [Memory monitoring](../docs/ios/features/feature_memory_monitoring.md)


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