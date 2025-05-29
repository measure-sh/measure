# Session Monitoring

* [**Get Current Session**](#get-current-session)
* [**Session Search**](#session-search)
* [**Session Timeline**](#session-timeline)

A session represents a continuous period of activity in the app. A new session begins when an app is launched for the
first time, or when there's been no activity for a 20-minute period. A single session can continue across multiple app
background and foreground events; brief interruptions will not cause a new session to be created.

The ability to find and view individual user sessions is one of the most effective ways to build an understanding
of how your app is used and to debug issues. Measure allows you to search of any session by various
attributes like device type, OS version, app version, user ID, and more. You can also view a timeline of events
for each session, including app launches, crashes, ANRs, errors, and custom events.

## Get Current Session

The current session can be retrieved by using `getSessionId` method.

### Android

```kotlin
val sessionId = Measure.getSessionId()
```

### iOS

Using swift:

```swift
let sessionId = Measure.shared.getSessionId()
```

or, in Objective-C:

```objc
NSString *sessionId = [[Measure shared] getSessionId];
```

## Session Search



## Session Timeline

// TODO: add content