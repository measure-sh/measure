# Session Monitoring

* [**What is a session?**](#what-is-a-session)
* [**Session Search**](#session-search)
* [**Session Timeline**](#session-timeline)
* [**API Reference**](#api-reference)
  * [**Get Current Session**](#get-current-session)

## What is a session?

A session is a continuous period of activity in the app. A new session begins when the app is launched for the first
time, or after 20 minutes of inactivity. Sessions can span across app background and foreground events, so short
interruptions won’t start a new session.

Being able to view individual user sessions is one of the most powerful ways to understand how your app is being used
and to troubleshoot issues.

## Session Search

You can easily find sessions using attributes like user ID, session ID, device model, app version, OS version, country,
and more. You can also search based on specific events, such as when a view was clicked or a screen was visited. This is
particularly useful for investigating user- or device-specific issues.

The session search supports all custom events and attributes defined in your app, allowing you to filter sessions based
on custom data like feature flags or user actions.

> [!TIP]
>
> A complex query can be constructed simply by using the filters UI and search box on the "sessions" page. For example,
> "find all sessions for 'premium' users in the 'US' using 'Android 16 or above', with 'latest app version' that have a
> 'click' event on a view with id 'btn_order_now'.

## Session Timeline

The session timeline shows you a detailed, chronological view of all events during a session.

You can see the exact order of actions leading up to an issue, making it easier to spot problems. The timeline also
includes memory and CPU usage graphs to help you understand how the app was performing at different moments.

Additionally, screenshots and layout snapshots give you a window into what the user saw at the time. This visual context
helps you catch UI issues, performance bottlenecks, or anything else that might not be obvious just from logs.


## API Reference

### Get Current Session

The current session can be retrieved by using `getSessionId` method. This is useful in cases where you want to send
the session ID to a different service or log it for debugging purposes.

#### Android

```kotlin
val sessionId = Measure.getSessionId()
```

#### iOS

Using Swift:

```swift
let sessionId = Measure.shared.getSessionId()
```

or, in Objective-C:

```objc
NSString *sessionId = [[Measure shared] getSessionId];
```