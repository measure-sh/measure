package sh.measure.android.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.isClassAvailable

internal interface ApplicationLifecycleStateListener {
    fun onAppForeground()
    fun onAppBackground()
}

/**
 * Tracks [Activity], Application and [Fragment] lifecycle events.
 */
internal class LifecycleCollector(
    private val application: Application,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val applicationLifecycleStateListener: ApplicationLifecycleStateListener,
) : ActivityLifecycleAdapter {
    private val fragmentLifecycleCollector by lazy {
        FragmentLifecycleCollector(eventProcessor, timeProvider)
    }
    private val startedActivities = mutableSetOf<String>()

    fun register() {
        application.registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        registerFragmentLifecycleCollector(activity)
        eventProcessor.track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.CREATED,
                class_name = activity.javaClass.name,
                // TODO(abhay): evaluate for sensitive data
                intent = activity.intent.dataString,
                saved_instance_state = savedInstanceState != null,
            ),
        )
    }

    override fun onActivityStarted(activity: Activity) {
        if (startedActivities.isEmpty()) {
            eventProcessor.track(
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                type = EventType.LIFECYCLE_APP,
                data = ApplicationLifecycleData(
                    type = AppLifecycleType.FOREGROUND,
                ),
            )
            applicationLifecycleStateListener.onAppForeground()
        }
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.add(hash)
    }

    override fun onActivityResumed(activity: Activity) {
        eventProcessor.track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.RESUMED,
                class_name = activity.javaClass.name,
            ),
        )
    }

    override fun onActivityPaused(activity: Activity) {
        eventProcessor.track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.PAUSED,
                class_name = activity.javaClass.name,
            ),
        )
    }

    override fun onActivityStopped(activity: Activity) {
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.remove(hash)
        if (startedActivities.isEmpty()) {
            eventProcessor.track(
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                type = EventType.LIFECYCLE_APP,
                data = ApplicationLifecycleData(
                    type = AppLifecycleType.BACKGROUND,
                ),
            )
            applicationLifecycleStateListener.onAppBackground()
        }
    }

    override fun onActivityDestroyed(activity: Activity) {
        eventProcessor.track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.DESTROYED,
                class_name = activity.javaClass.name,
            ),
        )
        if (isAndroidXFragmentAvailable() && activity is FragmentActivity) {
            activity.supportFragmentManager.unregisterFragmentLifecycleCallbacks(
                fragmentLifecycleCollector,
            )
        }
    }

    private fun registerFragmentLifecycleCollector(activity: Activity) {
        if (isAndroidXFragmentAvailable() && activity is FragmentActivity) {
            activity.supportFragmentManager.registerFragmentLifecycleCallbacks(
                fragmentLifecycleCollector,
                true,
            )
        }
    }

    private fun isAndroidXFragmentAvailable() =
        isClassAvailable("androidx.fragment.app.FragmentActivity")
}
