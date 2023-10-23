package sh.measure.android.lifecycle

import android.content.Context
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import sh.measure.android.events.EventTracker
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.iso8601Timestamp

internal class FragmentLifecycleCollector(
    private val eventTracker: EventTracker, private val timeProvider: TimeProvider
) : FragmentLifecycleAdapter() {
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