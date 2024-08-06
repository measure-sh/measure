# Feature - Navigation & Lifecycle

Measure SDK captures lifecycle and navigation events automatically, this includes the following:

1. [Application foregrounded/backgrounded](#application-foregroundedbackgrounded)
2. [Activity lifecycle](#activity-lifecycle)
3. [Fragment lifecycle](#fragment-lifecycle)
4. [Compose navigation](#compose-navigation)

## Application foregrounded/backgrounded

Measure automatically tracks when the application has come to foreground (is visible to the user) and when
it has been put into background (is no longer visible to the user).

### How it works

To detect when an Application goes to background, Measure
registers
tp [Application.ActivityLifecycleCallbacks](https://developer.android.com/reference/android/app/Application.ActivityLifecycleCallbacks)
callback and checks when the _last_ Activity on the stack receives an `onStop` event, effectively meaning the app is no
longer visible to the user.

Similarly, to detect when an Application comes back to foreground, Measure relies on the same callbacks to check when
the _first_ Activity on the stack receives an `onStart` event, effectively meaning the app is now visible to the user.

### Data collected

Checkout all the data collected for application lifecycle in
the [App Lifecycle Event](../../../docs/api/sdk/README.md#lifecycleapp) section.
section.

## Activity lifecycle

Measure automatically tracks the following Activity lifecycle events:

1. [Created](https://developer.android.com/guide/components/activities/activity-lifecycle#oncreate)
2. [Resumed](https://developer.android.com/guide/components/activities/activity-lifecycle#onresume)
3. [Paused](https://developer.android.com/guide/components/activities/activity-lifecycle#onpause)
4. [Destroyed](https://developer.android.com/guide/components/activities/activity-lifecycle#ondestroy)

### How it works

Similar to Application lifecycle, Measure
registers [ActivityLifecycleCallbacks](https://developer.android.com/reference/android/app/Application.ActivityLifecycleCallbacks)
and tracks the lifecycle events of each Activity.

### Data collected

Checkout all the data collected for Activity lifecycle in
the [Activity Lifecycle Event](../../../docs/api/sdk/README.md#lifecycleactivity) section.

## Fragment lifecycle

Measure automatically tracks the following Fragment lifecycle events:

1. [Attached](https://developer.android.com/reference/androidx/fragment/app/Fragment.html#onAttach(android.content.Context))
2. [Resumed](https://developer.android.com/reference/androidx/fragment/app/Fragment.html#onResume())
3. [Paused](https://developer.android.com/reference/androidx/fragment/app/Fragment.html#onPause())
4. [Detached](https://developer.android.com/reference/androidx/fragment/app/Fragment.html#onDetach())

## How it works

Measure
registers [FragmentLifecycleCallbacks](https://developer.android.com/reference/androidx/fragment/app/FragmentManager.FragmentLifecycleCallbacks)
to track the lifecycle events of each Fragment. This is only done if `androidx.Fragment` dependency is added to the
project.

## Data collected

Checkout all the data collected for Fragment lifecycle in
the [Fragment Lifecycle Event](../../../docs/api/sdk/README.md#lifecyclefragment) section.

> [!NOTE]  
> Measure supports androidx.Fragment lifecycle events only, the legacy android.app.Fragment is not supported.
> The Fragment lifecycle events are only tracked if the androidx.Fragment dependency is added to the app. Measure does
> not introduce any dependency on androidx.Fragment automatically.

## Navigation

### How it works

Measure instruments the [AndroidX navigation library](https://developer.android.com/guide/navigation)
using [ASM](https://asm.ow2.io/) by automatically tracking all
navigation events by
registering [NavController.OnDestinationChangedListener](https://developer.android.com/reference/androidx/navigation/NavController.OnDestinationChangedListener)
This is done using the Measure gradle plugin, read more details about
it [here](../../measure-android-gradle/README.md#androidx-navigation).

### Data collected

Checkout all the data collected for navigation in
the [Navigation Event](../../../docs/api/sdk/README.md#navigation) section.

> [!NOTE]  
> Compose navigation events are only tracked if the project uses Compose and the Compose navigation library. Measure
> does not introduce any dependency on Compose navigation library automatically.