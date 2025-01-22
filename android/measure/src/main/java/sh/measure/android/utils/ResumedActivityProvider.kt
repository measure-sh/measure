package sh.measure.android.utils

import android.app.Activity
import android.app.Application
import sh.measure.android.lifecycle.ActivityLifecycleAdapter
import java.lang.ref.WeakReference

/**
 * Provides the currently resumed activity.
 */
internal interface ResumedActivityProvider {
    fun register()
    fun getResumedActivity(): Activity?
    fun unregister()
}

/**
 * Implementation of [ResumedActivityProvider] that keeps a WeakReference to the resumed activity.
 */
internal class ResumedActivityProviderImpl(private val application: Application) :
    ResumedActivityProvider, ActivityLifecycleAdapter {
    private var resumedActivity: WeakReference<Activity>? = null

    override fun register() {
        application.registerActivityLifecycleCallbacks(this)
    }

    override fun getResumedActivity(): Activity? {
        return resumedActivity?.get()
    }

    override fun unregister() {
        resumedActivity?.clear()
        application.unregisterActivityLifecycleCallbacks(this)
    }

    override fun onActivityResumed(activity: Activity) {
        resumedActivity = WeakReference(activity)
    }

    override fun onActivityPaused(activity: Activity) {
        if (resumedActivity?.get() == activity) {
            resumedActivity = null
        }
    }
}
