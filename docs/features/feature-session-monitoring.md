# Session Monitoring

* [**What Is a Session?**](#what-is-a-session)
* [**Session Search**](#session-search)
* [**Session Timeline**](#session-timeline)
* [**API Reference**](#api-reference)
  * [**Get Current Session**](#get-current-session)

## What Is a Session?

A session is a continuous period of activity within the app. A new session begins when the app is launched for the first time or after 20 minutes of inactivity. Sessions can span across app background and foreground events, so short interruptions won’t start a new session.

## Session Search

You can easily find sessions using attributes like user ID, session ID, device model, app version, OS version, country, and more. You can also search based on specific events, such as when a view was clicked or a screen was visited. This is particularly useful for investigating user- or device-specific issues.

The session search supports all custom events and attributes defined in your app, allowing you to filter sessions based on custom data like feature flags or user actions.

> [!TIP]
>
> Construct complex queries easily using the filters UI and search box on the sessions page. For example, "find all sessions for 'premium' users in the 'US' using >'Android 16 or above', with the 'latest app version' that have a 'click' event on a view with ID 'btn_order_now'."

## Session Timeline

The session timeline provides a detailed, chronological view of all events during a session. You can see the exact order of actions leading up to an issue, making it easier to spot problems. The timeline also includes memory and CPU usage graphs to help you understand how the app was performing at different moments.

Additionally, screenshots and layout snapshots give you a window into what the user saw at the time. This visual context helps you catch UI issues, performance bottlenecks, or anything else that might not be obvious just from logs.

## API Reference

### Get Current Session

You can retrieve the current session using the `getSessionId` method. This is useful when you want to send the session ID to a different service or log it for debugging purposes.

#### Android

```kotlin
val sessionId = Measure.getSessionId()
```

#### iOS

Using Swift:

```swift
let sessionId = Measure.getSessionId()
```

or, in Objective-C:

```objc
NSString *sessionId = [Measure getSessionId];
```

#### Flutter

```dart
final String? sessionId = await Measure.instance.getSessionId();
```
