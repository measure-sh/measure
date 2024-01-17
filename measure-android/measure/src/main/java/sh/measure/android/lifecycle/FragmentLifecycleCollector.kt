package sh.measure.android.lifecycle

import android.content.Context
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import sh.measure.android.events.EventTracker
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.iso8601Timestamp

/**
 * Tracks [Fragment] lifecycle events.
 */
internal class FragmentLifecycleCollector(
    private val eventTracker: EventTracker,
    private val timeProvider: TimeProvider,
    private val currentThread: CurrentThread,
) : FragmentLifecycleAdapter() {
    override fun onFragmentAttached(fm: FragmentManager, f: Fragment, context: Context) {
        eventTracker.trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleType.ATTACHED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                tag = f.tag,
                thread_name = currentThread.name,
            ),
        )
    }

    override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {
        eventTracker.trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleType.RESUMED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                tag = f.tag,
                thread_name = currentThread.name,
            ),
        )
    }

    override fun onFragmentPaused(fm: FragmentManager, f: Fragment) {
        eventTracker.trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleType.PAUSED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                tag = f.tag,
                thread_name = currentThread.name,
            ),
        )
    }

    override fun onFragmentDetached(fm: FragmentManager, f: Fragment) {
        eventTracker.trackFragmentLifecycleEvent(
            FragmentLifecycleEvent(
                type = FragmentLifecycleType.DETACHED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                tag = f.tag,
                thread_name = currentThread.name,
            ),
        )
    }
}
