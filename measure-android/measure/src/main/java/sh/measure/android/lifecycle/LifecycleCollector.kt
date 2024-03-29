package sh.measure.android.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import sh.measure.android.events.EventProcessor
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.isClassAvailable
import sh.measure.android.utils.iso8601Timestamp

/**
 * Tracks [Activity], Application and [Fragment] lifecycle events.
 */
internal class LifecycleCollector(
    private val application: Application,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val onAppForeground: () -> Unit,
    private val onAppBackground: () -> Unit,
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
        eventProcessor.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.CREATED,
                class_name = activity.javaClass.name,
                // TODO(abhay): evaluate for sensitive data
                intent = activity.intent.dataString,
                saved_instance_state = savedInstanceState != null,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    override fun onActivityStarted(activity: Activity) {
        if (startedActivities.isEmpty()) {
            eventProcessor.trackApplicationLifecycleEvent(
                ApplicationLifecycleEvent(
                    type = AppLifecycleType.FOREGROUND,
                    timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                ),
            )
            onAppForeground.invoke()
        }
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.add(hash)
    }

    override fun onActivityResumed(activity: Activity) {
        eventProcessor.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.RESUMED,
                class_name = activity.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    override fun onActivityPaused(activity: Activity) {
        eventProcessor.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.PAUSED,
                class_name = activity.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            ),
        )
    }

    override fun onActivityStopped(activity: Activity) {
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.remove(hash)
        if (startedActivities.isEmpty()) {
            eventProcessor.trackApplicationLifecycleEvent(
                ApplicationLifecycleEvent(
                    type = AppLifecycleType.BACKGROUND,
                    timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                ),
            )
            onAppBackground.invoke()
        }
    }

    override fun onActivityDestroyed(activity: Activity) {
        eventProcessor.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleType.DESTROYED,
                class_name = activity.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
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

    private fun isAndroidXFragmentAvailable() = isClassAvailable("androidx.fragment.app.FragmentActivity")
}
