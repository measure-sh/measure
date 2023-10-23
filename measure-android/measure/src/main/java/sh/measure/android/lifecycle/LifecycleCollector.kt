package sh.measure.android.lifecycle

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.FragmentManager
import sh.measure.android.events.EventTracker
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.iso8601Timestamp

internal class LifecycleCollector(
    private val application: Application,
    private val eventTracker: EventTracker,
    private val timeProvider: TimeProvider
) : ActivityLifecycleAdapter, FragmentLifecycleAdapter() {

    fun register() {
        application.registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        if (savedInstanceState == null && activity is FragmentActivity) {
            activity.supportFragmentManager.registerFragmentLifecycleCallbacks(
                this, true
            )
        }
        eventTracker.trackActivityLifecycleEvent(
            ActivityLifecycleEvent(
                type = ActivityLifecycleName.CREATED,
                class_name = activity.javaClass.name,
                intent = activity.intent.dataString,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

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
        if (activity is FragmentActivity) {
            activity.supportFragmentManager.unregisterFragmentLifecycleCallbacks(this)
        }
    }

    override fun onFragmentAttached(fm: FragmentManager, f: Fragment, context: Context) {
        eventTracker.trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleName.ATTACHED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {
        eventTracker.trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleName.RESUMED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    override fun onFragmentPaused(fm: FragmentManager, f: Fragment) {
        eventTracker.trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleName.PAUSED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }

    override fun onFragmentDetached(fm: FragmentManager, f: Fragment) {
        eventTracker.trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleName.DETACHED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
            )
        )
    }
}
