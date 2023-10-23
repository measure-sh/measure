package sh.measure.android.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import sh.measure.android.events.EventTracker
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.isClassAvailable
import sh.measure.android.utils.iso8601Timestamp

internal class LifecycleCollector(
    private val application: Application,
    private val eventTracker: EventTracker,
    private val timeProvider: TimeProvider
) : ActivityLifecycleAdapter {
    private val fragmentLifecycleCollector by lazy {
        FragmentLifecycleCollector(eventTracker, timeProvider)
    }

    fun register() {
        application.registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        registerFragmentLifecycleCollector(activity)
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.CREATED,
                class_name = activity.javaClass.name,
                intent = activity.intent.dataString,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    private fun registerFragmentLifecycleCollector(activity: Activity) {
        if (isAndroidXFragmentAvailable() && activity is FragmentActivity) {
            activity.supportFragmentManager.registerFragmentLifecycleCallbacks(
                fragmentLifecycleCollector, true
            )
        }
    }

    private fun isAndroidXFragmentAvailable() =
        isClassAvailable("androidx.fragment.app.FragmentActivity")

    override fun onActivityResumed(activity: Activity) {
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.RESUMED,
                class_name = activity.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    override fun onActivityPaused(activity: Activity) {
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.PAUSED,
                class_name = activity.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    override fun onActivityDestroyed(activity: Activity) {
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.DESTROYED,
                class_name = activity.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
        if (isAndroidXFragmentAvailable() && activity is FragmentActivity) {
            activity.supportFragmentManager.unregisterFragmentLifecycleCallbacks(
                fragmentLifecycleCollector
            )
        }
    }
}
