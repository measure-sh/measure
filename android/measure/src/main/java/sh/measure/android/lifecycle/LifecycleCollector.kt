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
) : ActivityLifecycleAdapter {
    private val fragmentLifecycleCollector by lazy {
        FragmentLifecycleCollector(eventProcessor, timeProvider)
    }
    private val startedActivities = mutableSetOf<String>()
    private var applicationLifecycleStateListener: ApplicationLifecycleStateListener? = null

    fun register() {
        application.registerActivityLifecycleCallbacks(this)
    }

    fun setApplicationLifecycleStateListener(listener: ApplicationLifecycleStateListener) {
        applicationLifecycleStateListener = listener
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        registerFragmentLifecycleCollector(activity)
        eventProcessor.track(
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.CREATED,
                class_name = activity.javaClass.name,
                saved_instance_state = savedInstanceState != null,
                intent = activity.intent.dataString,
            ),
        )
    }

    override fun onActivityStarted(activity: Activity) {
        if (startedActivities.isEmpty()) {
            // letting listeners know about app foreground before tracking the event
            // session manager depends on this sequence to ensure that new session ID (if created)
            // is reflected in all events collected after the launch.
            applicationLifecycleStateListener?.onAppForeground()
            eventProcessor.track(
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                type = EventType.LIFECYCLE_APP,
                data = ApplicationLifecycleData(
                    type = AppLifecycleType.FOREGROUND,
                ),
            )
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
            // letting listeners know about app background after tracking the event as
            // this allows the event to be collected before any clean up is done
            // due to the app moving to background.
            applicationLifecycleStateListener?.onAppBackground()
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
