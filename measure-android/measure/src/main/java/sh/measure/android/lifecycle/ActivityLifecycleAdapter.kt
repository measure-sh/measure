package sh.measure.android.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle

/**
 * An empty implementation of [Application.ActivityLifecycleCallbacks] that can be used to
 * keep it's implementors clean.
 */
internal interface ActivityLifecycleAdapter : Application.ActivityLifecycleCallbacks {
    override fun onActivityPreCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityPostCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityPreStarted(activity: Activity) {}
    override fun onActivityStarted(activity: Activity) {}
    override fun onActivityPostStarted(activity: Activity) {}
    override fun onActivityPreResumed(activity: Activity) {}
    override fun onActivityResumed(activity: Activity) {}
    override fun onActivityPostResumed(activity: Activity) {}
    override fun onActivityPrePaused(activity: Activity) {}
    override fun onActivityPaused(activity: Activity) {}
    override fun onActivityPostPaused(activity: Activity) {}
    override fun onActivityPreStopped(activity: Activity) {}
    override fun onActivityStopped(activity: Activity) {}
    override fun onActivityPostStopped(activity: Activity) {}
    override fun onActivityPreSaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityPostSaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityPreDestroyed(activity: Activity) {}
    override fun onActivityDestroyed(activity: Activity) {}
    override fun onActivityPostDestroyed(activity: Activity) {}
}