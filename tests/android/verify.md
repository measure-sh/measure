# Android Verification

## Overview

- Chart shows 1 Crash and 1 ANR
- Adoption shows multiple sessions (8 per full test run)
- All metric cards have a value

## Crashes

- One crash is visible on the chart
- One crash is visible in the list `NativeAndroidScreen.kt: NativeAndroidScreen`, `java.lang.IllegalAccessException`
- Crash detail charts show one instance
- Common path is visible
- A screenshot is visible with masking applied based on the config set
- Copy AI context works
- Device name is visible
- App version is visible
- Network type is visible
- Stacktrace is symbolicated and starts with the following:

```
java.lang.IllegalAccessException: This is a new exception
	at sh.frankenstein.android.NativeAndroidScreenKt.NativeAndroidScreen$lambda$11$0(NativeAndroidScreen.kt:138)
	at sh.frankenstein.android.NativeAndroidScreenKt.DemoCard$lambda$0$0(NativeAndroidScreen.kt:363)
```
- View session timeline opens the session timeline

## ANRs

- One ANR is visible on the chart
- One ANR is visible in the list `NativeAndroidScreen.kt: DemoCard`, `sh.measure.android.anr.AnrError`
- ANR detail charts show one instance
- Common path is visible
- A screenshot is visible with masking applied based on the config set
- Copy AI context works
- Device name is visible
- App version is visible
- Network type is visible
- Stacktrace is symbolicated and starts with the following:

```
sh.measure.android.anr.AnrError: Application Not Responding for at least 5s
	at sh.frankenstein.android.NativeAndroidScreenKt.DemoCard$lambda$0$0(NativeAndroidScreen.kt:363)	
```

- View session timeline opens the session timeline

## Bug Reports

- One Bug Report is visible on the chart
- One Bug Report is visible in the list `e2e test bug report` with `Open` status
- Bug Report detail shows the description and screenshot
- Close/Re-Open button toggles the bug report status
- View session timeline opens the session timeline

## Session Timelines

### Cold Launch

- Search for a session with `cold_launch` event
- Session timeline shows the cold launch event with duration

### Warm Launch

- Search for a session with `warm_launch` event
- Session timeline shows the warm launch event with duration

### Activity Lifecycle

- Search for a session with `activity_lifecycle` event
- Session timeline shows the activity lifecycle events with class name


### Screen View

- Search for a session with `screen_view` event
- Session timeline shows the screen view events with name of the screen

### Click

- Search for a session with `gesture_click` event
- Session timeline shows the click events with class name of the view
- Shows the layout snapshot with the clicked view highlighted

### Lifecycle App

- Search for a session with `lifecycle_app` event
- Session timeline shows the lifecycle app events with foreground/background type
- No activity or fragment lifecycle events are shown after the app is in background

### Custom Event

- Search for a session with `custom_event` event
- Session timeline shows the custom event with name `custom_event_all_attrs`
- Session timeline shows the custom event with following attributes:
  - boolean_attr: true
  - double_attr: 3.141592653589793
  - float_attr: 2.718
  - int_attr: 42
  - long_attr: 9000000000
  - string_attr: hello

### Handled Exception

- Search for a session with an `exception` event marked as handled
- Session timeline shows the handled exception `java.io.IOException: This is a handled exception` with a nested cause `CustomException: Caused by a custom nested exception`
- Stacktrace is symbolicated and points into `NativeAndroidScreen.kt`
- Event carries the following custom attributes:
  - boolean_attr: true
  - double_attr: 3.141592653589793
  - float_attr: 2.718
  - int_attr: 42
  - long_attr: 9000000000
  - string_attr: hello

### Trim memory

- Search for a session with `trim_memory` event
- Session timeline shows the trim memory event with a level like `TRIM_MEMORY_UI_HIDDEN`

### Network Change

- Search for a session with `network_change` event
- Session timeline shows two network change events  (e.g. `wifi/celluar` → `no_network` → `wifi/cellular`)

### HTTP

- Search for a session with `http` event
- Session timeline shows the HTTP event with following attributes:
  - method
  - url
  - status
  - request headers
  - response headers
  - request body
  - response body
- To see the request and response body:
  - Allow capturing HTTP request/response body in the App settings for `https://postman-echo.com/*`
  - Re-run the http test


#### Fragment Lifecycle (TODO)

- Search for a session with `fragment_lifecycle` event
- Session timeline shows the fragment lifecycle events with fragment and activity class name

#### Long click (TODO)

- Search for a session with `gesture_long_click` event
- Session timeline shows the long click events with class name of the view

#### Scroll (TODO)

- Search for a session with `gesture_scroll` event
- Session timeline shows the scroll events with class name of the view

## Traces

- Filter by trace name `root`
- The traces list shows multiple root traces
- Click on a trace to view its details
- Trace should have 4 child spans (`screen.interests`, `http`, `screen.for_you`, `screen.main`)
- View session timeline shows the session timeline with the trace item with trace duration

## Network

- Run the http test with 200 requests
- Explore endpoint show `https://postman-echo.com` domain with paths like `get`, `post`
- Shows status distribution of all requests made
- Top Endpoints and Timeline can take 1 hour to generate, they'll remain empty meanwhile
- Clicking any URL should open the detailed charts with latency and status distribution

## Apps

- Shows `sh.frankenstein.android` as the app identifier
- Shows `android` as the operating system

## Adaptive config

Follow these steps in order:

- Set crash timeline, anr timeline and bug report timeline to 1 second
- Set disable HTTP event for URLs to `https://postman-echo.com/*`
- Set screenshot masking to a different value than the one selected.
- Rerun all test.
- Verify the timeline matches the config setup.
  - Only last 1 second of the session timeline should be visible.
  - The network requests should not be captured for disabled URLs.
  - Screenshot masking should match the config.
