package sh.measure.android.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle
import androidx.compose.ui.util.fastForEachReversed

internal interface AppLifecycleListener {
    fun onAppForeground()
    fun onAppBackground()
}

internal interface ActivityLifecycleListener {
    fun onActivityPreCreated(activity: Activity, savedInstanceState: Bundle?)
    fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?)
    fun onActivityStarted(activity: Activity)
    fun onActivityResumed(activity: Activity)
    fun onActivityPaused(activity: Activity)
    fun onActivityDestroyed(activity: Activity)
}

internal class AppLifecycleManager(
    private val application: Application,
) : ActivityLifecycleAdapter {
    private val startedActivities = mutableSetOf<String>()
    private val activityLifecycleListeners = mutableListOf<ActivityLifecycleListener>()
    private var appLifecycleListeners = mutableListOf<AppLifecycleListener>()

    fun register() {
        application.registerActivityLifecycleCallbacks(this)
    }

    fun unregister() {
        application.unregisterActivityLifecycleCallbacks(this)
    }

    fun addListener(listener: ActivityLifecycleListener) {
        activityLifecycleListeners.add(listener)
    }

    fun removeListener(listener: ActivityLifecycleListener) {
        activityLifecycleListeners.remove(listener)
    }

    fun addListener(listener: AppLifecycleListener) {
        appLifecycleListeners.add(listener)
    }

    fun removeListener(listener: AppLifecycleListener) {
        appLifecycleListeners.remove(listener)
    }

    override fun onActivityPreCreated(activity: Activity, savedInstanceState: Bundle?) {
        activityLifecycleListeners.forEach { it.onActivityPreCreated(activity, savedInstanceState) }
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        activityLifecycleListeners.forEach { it.onActivityCreated(activity, savedInstanceState) }
    }

    override fun onActivityStarted(activity: Activity) {
        if (startedActivities.isEmpty()) {
            appLifecycleListeners.forEach { it.onAppForeground() }
        }
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.add(hash)
        activityLifecycleListeners.forEach { it.onActivityStarted(activity) }
    }

    override fun onActivityResumed(activity: Activity) {
        activityLifecycleListeners.forEach { it.onActivityResumed(activity) }
    }

    override fun onActivityPaused(activity: Activity) {
        activityLifecycleListeners.forEach { it.onActivityPaused(activity) }
    }

    override fun onActivityStopped(activity: Activity) {
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.remove(hash)
        if (startedActivities.isEmpty()) {
            // Reversed listeners so that the one that
            // registered first, gets called first.
            // Not doing so can lead to App Lifecycle
            // background event to be called after export
            // and cleanup have occurred.
            appLifecycleListeners.fastForEachReversed { it.onAppBackground() }
        }
    }

    override fun onActivityDestroyed(activity: Activity) {
        activityLifecycleListeners.forEach { it.onActivityDestroyed(activity) }
    }
}
