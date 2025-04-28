# Feature - Screen load time

Measure can automatically track the time taken to load a ViewController. This feature is enabled by default and can be disabled during SDK initialization by setting `trackViewControllerLoadTime` to `false`.

**ViewController load time** measures the time between the ViewController's view being loaded and the first frame drawn on the screen. This is also known as Time to First Frame or Time to Initial Display (TTID).

Each ViewController load time is captured using a unique span with the name `VC TTID` followed by the fully qualified class name of the ViewController. For example, for `MainViewController` the span name would be `VC TTID MainViewController`.

An attribute called `app_startup_first_view_controller` with value of _true_ is automatically added to the span to indicate if the ViewController was being loaded as part of a [cold](feature_app_launch.md#cold-launch) launch.

A large TTID means users wait too long to see content while navigating the app.

> Note that the fully qualified ViewController name may be truncated to fit within the 64 character limits for span names.

**ViewController load time** tracking works by monitoring the ViewController's lifecycle events:

1. The span starts in either the `loadView` or `viewDidLoad` callback of the ViewController:
   - If you inherit from `MsrViewController` (Swift) or `MSRViewController` (Objective-C), the span will start from `loadView`.
   - Otherwise, the span will start from `viewDidLoad`.
2. The span ends when `viewDidAppear` is called, indicating that the view is fully visible on screen.

## How it works

The SDK uses method swizzling to automatically track these lifecycle events without requiring any manual instrumentation.

## Data captured

A span with the name `VC TTID {view controller name}` is created for each ViewController load.

The ViewController TTID span may have the following attributes if applicable:

| Attribute                          | Description                                                      |
|------------------------------------|------------------------------------------------------------------|
| app_startup_first_view_controller  | Whether this view controller is the first one launched in the app. |

The spans have the following checkpoints:

| Checkpoint                  | Description                                     |
|-----------------------------|-------------------------------------------------|
| vc_load_view                | The time when the view was loaded.              |
| vc_view_did_load            | The time when the view was loaded into memory.  |
| vc_view_will_appear         | The time when the view is about to appear.      |
| vc_view_did_appear          | The time when the view is fully visible.        |
