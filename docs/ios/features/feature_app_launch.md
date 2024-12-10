# Feature - App Launch

Measure tracks the cold, warm and hot app launch along with the time taken for each. No additional code is required to
enable this feature.

## How it works

* [Cold launch](#cold-launch)
* [Warm launch](#warm-launch)
* [Hot launch](#hot-launch)

### Cold launch

A cold launch refers to an app starting up from scratch. Cold launches occur when the app is launched after reboot or when the app is updated. When an app is launched from scratch, the app is brought from the disk to the memory, iOS loads startup system-side services that support the app, frameworks and daemons that the app depends on to launch might also require re-launching and paging in from disk. Once this is done, the process is spanned.

### Warm launch

Once cold launch is done, for every subsequent launch, the app still needs to be spanned but the app is still in memory and some of the system-side services are already available. So this launch is a bit faster and a bit more consistent. This type of launch is referred to as the warm launch.

In iOS 15 and later, the system may, depending on device conditions, **prewarm** your app, launch non-running application processes to reduce the amount of time the user waits before the app is usable. Prewarming executes an app’s launch sequence up until, but not including, when main() calls UIApplicationMain. This provides the system with an opportunity to build and cache any low-level structures it requires in anticipation of a full launch.

After the system prewarms your app, its launch sequence remains in a paused state until the app launches and the sequence resumes, or the system removes the prewarmed app from memory to reclaim resources. The system can prewarm your app after a device reboot, and periodically as system conditions allow.

### Hot launch

A hot launch occurs when a user reenters your app from either the home screen or the app switcher. As you know, the app is already launched at this point, so it's going to be very fast. Apple generally refers to this as a `resume` rather than a hot launch.

## Data collected

Checkout the data collected by Measure for [Cold Launch](../../api/sdk/README.md#coldlaunch), [Warm Launch](../../api/sdk/README.md#warmlaunch) and [Hot Launch](../../api/sdk/README.md#hotlaunch) sections respectively.

### Further reading

* [WWDC talk on app startup](https://developer.apple.com/videos/play/wwdc2019/423)
* [Reducing your app launch time](https://developer.apple.com/documentation/xcode/reducing-your-app-s-launch-time)