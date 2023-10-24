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
    private val startedActivities = mutableSetOf<String>()

    fun register() {
        application.registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        registerFragmentLifecycleCollector(activity)
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.CREATED,
                class_name = activity.javaClass.name,
                // TODO(abhay): evaluate for sensitive data
                intent = activity.intent.dataString,
                saved_instance_state = savedInstanceState != null,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    override fun onActivityStarted(activity: Activity) {
        if (startedActivities.isEmpty()) {
            eventTracker.trackApplicationLifecycleEvent(
                ApplicationLifecycleEvent(
                    type = AppLifecycleType.FOREGROUND,
                    timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                )
            )
        }
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.add(hash)
    }

    override fun onActivityResumed(activity: Activity) {
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.RESUMED,
                class_name = activity.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    override fun onActivityPaused(activity: Activity) {
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.PAUSED,
                class_name = activity.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    override fun onActivityStopped(activity: Activity) {
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.remove(hash)
        if (startedActivities.isEmpty()) {
            eventTracker.trackApplicationLifecycleEvent(
                ApplicationLifecycleEvent(
                    type = AppLifecycleType.BACKGROUND,
                    timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                )
            )
        }
    }

    override fun onActivityDestroyed(activity: Activity) {
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.DESTROYED,
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

    private fun registerFragmentLifecycleCollector(activity: Activity) {
        if (isAndroidXFragmentAvailable() && activity is FragmentActivity) {
            activity.supportFragmentManager.registerFragmentLifecycleCallbacks(
                fragmentLifecycleCollector, true
            )
        }
    }

    private fun isAndroidXFragmentAvailable() =
        isClassAvailable("androidx.fragment.app.FragmentActivity")
}
