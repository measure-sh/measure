# Feature - App Launch

Measure tracks the cold, warm and hot app launch along with the time taken for each. No additional code is required to
enable this feature.

## How it works

* [Cold launch](#cold-launch)
* [Warm launch](#warm-launch)
* [Hot launch](#hot-launch)

### Cold launch

A [cold launch](https://developer.android.com/topic/performance/vitals/launch-time#cold) refers to an app starting
from scratch. Cold launch happens in cases such as an app launching for the first time since the device booted or since
the system killed the app.

There are typically two important metrics to track for cold launch:

1. **Time to Initial Display (TTID)** - the time taken from when the app was launched to when the first frame is
   displayed.
2. **Time to Full Display (TTFD)** - the time taken from when the app was launched to when the first meaningful content
   is displayed to the user.

> [!NOTE]  
> Measuring TTFD is not possible yet, support will be added in a future version.

Meanwhile, **Time to Initial Display (TTID)** is automatically calculated by recording two timestamps:

1. The time when the app was launched.
2. The time when the app's first frame was displayed.

_The time when app was launched_ is calculated differently for different SDK versions, we use the most accurate
measurement possible for the given SDK version.

* Up to API 24: the _uptime_ when Measure content provider's attachInfo callback is invoked.
* API 24 - API 32: the process start uptime,
  using [Process.getStartUptimeMillis](https://developer.android.com/reference/android/os/Process#getStartUptimeMillis())
* API 33 and beyond: the process start uptime,
  using [Process.getStartRequestedUptimeMillis](https://developer.android.com/reference/android/os/Process#getStartRequestedUptimeMillis())

_The time when app's first frame was displayed_ is a bit more complex. Simplifying some of the steps, it is calculated
in the following way:

1. Get the decor view by registering
   [onContentChanged](https://developer.android.com/reference/android/app/Activity#onContentChanged()) callback on the
   first Activity.
2. Get the next draw callback by
   registering [OnDrawListener](https://developer.android.com/reference/android/view/ViewTreeObserver.OnDrawListener) on
   the decor view.
3. [Post a runnable in front of the next draw callback](https://github.com/square/papa/blob/main/papa/src/main/java/papa/internal/Handlers.kt#L8-L13)
   to record the time just before the first frame was displayed.

### Warm launch

A [warm launch](https://developer.android.com/topic/performance/vitals/launch-time#warm) refers to the re-launch of an
app causing an Activity `onCreate` to be triggered instead of just `onResume`. This requires the system to recreate
the activity from scratch and hence requires more work than a hot launch.

Warm launch is calculated by keeping track of the time when the Activity `onCreate` of the Activity being recreated is
triggered and the time when the first frame is displayed. The same method as for cold launch is used to calculate the
time when the first frame is displayed.

### Hot launch

A [hot launch](https://developer.android.com/topic/performance/vitals/launch-time#hot) refers to the re-launch of an
app causing an Activity `onResume` to be triggered. This typically requires less work than a warm launch as the system
does not need to recreate the activity from scratch. However, if there were any trim memory events leading to the
certain resources being released, the system might need to recreate those resources.

## Data collected

Checkout the data collected by Measure
for [Cold Launch](../../api/sdk/README.md#coldlaunch), [Warm Launch](../../api/sdk/README.md#warmlaunch)
and [Hot Launch](../../api/sdk/README.md#hotlaunch) sections respectively.

### Further reading

* [Android docs on app startup](https://developer.android.com/topic/performance/vitals/launch-time#warm)
* [Py's android vitals series](https://dev.to/pyricau/series/7827)
* [Py's PAPA github project](https://github.com/square/papa)
