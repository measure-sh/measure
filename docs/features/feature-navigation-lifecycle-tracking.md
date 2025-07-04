# Navigation & Lifecycle Tracking

- [**Introduction**](#introduction)
- [**Lifecycle events**](#lifecycle-events)
    - [**Android**](#android)
        - [**Activity Lifecycle**](#activity-lifecycle)
        - [**Fragment Lifecycle**](#fragment-lifecycle)
        - [**AndroidX Navigation**](#androidx-navigation)
    - [**iOS**](#ios)
        - [**View Controller Lifecycle**](#view-controller-lifecycle)
        - [**SwiftUI lifecycle**](#swiftui-lifecycle)
- [**Manually track screen views**](#manually-track-screen-views)
- [**Application foregrounded/backgrounded**](#application-foregroundedbackgrounded)

## Introduction

When debugging your application, understanding how users navigate through your app and how different components of your
app are initialized and destroyed is crucial. Measure provides automatic tracking of many lifecycle events in
your application, allowing you to gain insights into user journeys and component lifecycles without writing additional
code. There is also an option to manually track screen views if you need more control over what is tracked.

For _Android_, Lifecycle events for Activity, Fragments and from AndroidX navigation library (including compose) are
automatically tracked.

For _iOS_, lifecycle events for View Controllers are automatically tracked. For `SwiftUI`, you can track lifecycle
events by wrapping your views with `MsrMoniterView` or using the `moniterWithMsr` extension.

Application foregrounded and backgrounded events are also automatically tracked, allowing you to understand when the
application is visible to the user and when it is not.

Apart from these automatically collected events, `trackScreenView` method can be used to manually track screen views
in your application. This is useful for getting a more detailed view of user's journey depending on how your app is
structured.

## Application foregrounded/backgrounded

Measure automatically tracks when the application has come to foreground (is visible to the user) and when
it has been put into background (is no longer visible to the user).

## Lifecycle events

### Android

#### Activity Lifecycle

Measure automatically tracks the following Activity lifecycle events:

1. [Created](https://developer.android.com/guide/components/activities/activity-lifecycle#oncreate)
2. [Resumed](https://developer.android.com/guide/components/activities/activity-lifecycle#onresume)
3. [Paused](https://developer.android.com/guide/components/activities/activity-lifecycle#onpause)
4. [Destroyed](https://developer.android.com/guide/components/activities/activity-lifecycle#ondestroy)

#### Fragment Lifecycle

Measure automatically tracks the following Fragment lifecycle events:

1. [Attached](https://developer.android.com/reference/androidx/fragment/app/Fragment.html#onAttach(android.content.Context))
2. [Resumed](https://developer.android.com/reference/androidx/fragment/app/Fragment.html#onResume())
3. [Paused](https://developer.android.com/reference/androidx/fragment/app/Fragment.html#onPause())
4. [Detached](https://developer.android.com/reference/androidx/fragment/app/Fragment.html#onDetach())

#### AndroidX Navigation

If you rely on AndroidX Navigation library for navigation in your Android app, a `screen_view` event is automatically
tracked whenever a new destination is navigated to. This works using the instrumentation added by Measure Gradle Plugin
and no code changes are needed to track these events.

### iOS

#### View Controller Lifecycle

Measure automatically tracks the following View Controller lifecycle events:

1. `viewDidLoad`
2. `viewWillAppear`
3. `viewDidAppear`
4. `viewWillDisappear`
5. `viewDidDisappear`
6. `didReceiveMemoryWarning`
7. `initWithNibName`
8. `initWithCoder`

> [!TIP]
>
> You can also track `loadView` and `deinit`/`dealloc` by inheriting from `MsrViewController` for swift
> and `MSRViewController` for ObjC. An example of how to do this is shown below.

Using Swift:

```swift
   class ViewController: MsrViewController {
     ...
   }
```

Using Objective-C:

```objc
   @interface ObjcDetailViewController: MSRViewController
    ...
   @end
```

#### SwiftUI lifecycle

Measure can track SwiftUI component's `onAppear` and `onDisappear` if you wrap your view with the `MsrMoniterView`. It
ensures that each appearance event is only triggered once per lifecycle instance. Additionally, you can use
the `moniterWithMsr` extension to conveniently wrap any SwiftUI view.

Example usage:

**Using `MsrMoniterView`:**

```swift
struct ContentView: View {
    var body: some View {
        MsrMoniterView("ContentView") {
            Text("Hello, World!")
        }
    }
}
```

**Using `moniterWithMsr`:**

```swift
struct ContentView: View {
    var body: some View {
        Text("Hello, World!")
            .moniterWithMsr("ContentView")
    }
}
```

## Manually track screen views

If you want to manually track screen views in your application, you can use the `trackScreenView` method. This is useful
when you want to track specific screens or views that are not automatically tracked by Measure.

#### Android

```kotlin
Measure.trackScreenView("Screen Name")
```

#### iOS

Using Swift:

```swift
Measure.trackScreenView("Home")
```

Using ObjC:

```objc
[Measure trackScreenView:@"Home"];
```

## Data collected

Check the following sections for the data collected by Measure for each lifecycle event:

- [App Lifecycle Event](../api/sdk/README.md#lifecycleapp) — for application foregrounded and backgrounded.
- [Activity Lifecycle Event](../api/sdk/README.md#lifecycleactivity) — for `Activity` lifecycle events.
- [Fragment Lifecycle Event](../api/sdk/README.md#lifecyclefragment) — for `Fragment` lifecycle events.
- [View Controller Lifecycle Event](https://github.com/measure-sh/measure/blob/main/docs/api/sdk/README.md#lifecycle_view_controller) —
  for `UIViewController` lifecycle events.
- [SwiftUI Lifecycle Event](https://github.com/measure-sh/measure/blob/main/docs/api/sdk/README.md#lifecycle_swift_ui) —
  for
  `SwiftUI` lifecycle events.
- [Screen View Event](../api/sdk/README.md#screenview) — for screen view events.
