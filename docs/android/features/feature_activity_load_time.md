# Feature - Activity load time

Measure can automatically track the time taken to load an Activity. This feature is enabled by default and
can be disabled during SDK initialization using `MeasureConfig(trackActivityLoadTime = false)`.

Activity load time measures the time between the Activity being created and the first
frame being drawn on the screen. This is also known as Time to First Frame or
Time to Initial Display (TTID). A large duration means users wait too long to see content while navigating the app.

Each Activity load time is captured using a unique span with the name `Activity TTID` followed
by the fully qualified class name of the Activity. For example, for `MainActivity` the span
name would be `Activity TTID com.example.MainActivity`.

An attribute called `app_startup_first_activity` with value of _true_ is automatically added to the span to indicate
if the Activity was being loaded as part of a [cold](feature_app_launch.md#cold-launch) launch.

> Note that the fully qualified activity name may be truncated to fit within the 64 character limits for span names.

## How it works

Activity load time is calculated by starting a span in the `onCreate` method of the Activity. The span is ended
when the first frame is drawn on the screen. Measure uses two techniques for this.

1. Attach a `View.addOnAttachStateChangeListener` to the root view of the Activity to detect when the view is
   attached to the window.
2. Post runnable using `Handler.sendMessageAtFrontOfQueue` on the main thread as a proxy for detecting when the
   first frame is drawn.

## Data captured

A span with the name `Activity TTID {fully qualified activity name}` is created for each Activity load.

The span has the following attributes:

| Attribute                           | Description                                                      |
|-------------------------------------|------------------------------------------------------------------|
| app_startup_first_activity | Whether this activity is the first activity launched in the app. |

The span has the following checkpoints:

| Checkpoint                 | Description                             |
|----------------------------|-----------------------------------------|
| activity_lifecycle_created | The time when the Activity was created. |
| activity_lifecycle_started | The time when the Activity was started. |
| activity_lifecycle_resumed | The time when the Activity was resumed. |
