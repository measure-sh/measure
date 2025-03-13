package sh.measure.android.lifecycle

import android.app.Activity
import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.tracing.Tracer
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.isClassAvailable
import java.util.concurrent.atomic.AtomicBoolean

internal class ActivityLifecycleCollector(
    private val appLifecycleManager: AppLifecycleManager,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val tracer: Tracer,
) : ActivityLifecycleListener {
    private val fragmentLifecycleCollector by lazy {
        FragmentLifecycleCollector(signalProcessor, timeProvider, configProvider, tracer)
    }
    private val androidXFragmentNavigationCollector by lazy {
        AndroidXFragmentNavigationCollector(signalProcessor, timeProvider)
    }

    private var isRegistered = AtomicBoolean(false)

    fun register() {
        if (!isRegistered.getAndSet(true)) {
            appLifecycleManager.addListener(this)
        }
    }

    fun unregister() {
        if (isRegistered.getAndSet(false)) {
            appLifecycleManager.removeListener(this)
        }
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        registerFragmentLifecycleCollector(activity)
        registerAndroidXFragmentNavigationCollector(activity)
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.CREATED,
                class_name = activity.javaClass.name,
                saved_instance_state = savedInstanceState != null,
                intent = activity.intent.dataString,
            ),
        )
    }

    override fun onActivityResumed(activity: Activity) {
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.RESUMED,
                class_name = activity.javaClass.name,
            ),
        )
    }

    override fun onActivityPaused(activity: Activity) {
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.LIFECYCLE_ACTIVITY,
            data = ActivityLifecycleData(
                type = ActivityLifecycleType.PAUSED,
                class_name = activity.javaClass.name,
            ),
        )
    }

    override fun onActivityDestroyed(activity: Activity) {
        signalProcessor.track(
            timestamp = timeProvider.now(),
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

    private fun registerAndroidXFragmentNavigationCollector(activity: Activity) {
        if (isAndroidXFragmentNavigationAvailable() && activity is FragmentActivity) {
            activity.supportFragmentManager.registerFragmentLifecycleCallbacks(
                androidXFragmentNavigationCollector,
                true,
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

    private fun isAndroidXFragmentNavigationAvailable() =
        isClassAvailable("androidx.navigation.fragment.NavHostFragment")
}
