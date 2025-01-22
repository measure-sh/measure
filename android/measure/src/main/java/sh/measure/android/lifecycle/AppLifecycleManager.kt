package sh.measure.android.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle

internal interface AppLifecycleListener {
    fun onAppForeground()
    fun onAppBackground()
}

internal interface ActivityLifecycleListener {
    fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?)
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

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        activityLifecycleListeners.forEach { it.onActivityCreated(activity, savedInstanceState) }
    }

    override fun onActivityStarted(activity: Activity) {
        if (startedActivities.isEmpty()) {
            appLifecycleListeners.forEach { it.onAppForeground() }
        }
        val hash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.add(hash)
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
            appLifecycleListeners.forEach { it.onAppBackground() }
        }
    }

    override fun onActivityDestroyed(activity: Activity) {
        activityLifecycleListeners.forEach { it.onActivityDestroyed(activity) }
    }
}
