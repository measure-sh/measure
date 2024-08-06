package sh.measure.android.lifecycle

import android.content.Context
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.utils.TimeProvider

/**
 * Tracks [Fragment] lifecycle events.
 */
internal class FragmentLifecycleCollector(
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
) : FragmentLifecycleAdapter() {
    override fun onFragmentAttached(fm: FragmentManager, f: Fragment, context: Context) {
        eventProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.ATTACHED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                tag = f.tag,
            ),
        )
    }

    override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {
        eventProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.RESUMED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                tag = f.tag,
            ),
        )
    }

    override fun onFragmentPaused(fm: FragmentManager, f: Fragment) {
        eventProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.PAUSED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                tag = f.tag,
            ),
        )
    }

    override fun onFragmentDetached(fm: FragmentManager, f: Fragment) {
        eventProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.DETACHED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                tag = f.tag,
            ),
        )
    }
}
