package sh.measure.android.lifecycle

import android.content.Context
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.utils.TimeProvider

/**
 * Tracks [Fragment] lifecycle events.
 */
internal class FragmentLifecycleCollector(
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
) : FragmentLifecycleAdapter() {
    override fun onFragmentAttached(fm: FragmentManager, f: Fragment, context: Context) {
        signalProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.now(),
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.ATTACHED,
                parent_activity = f.activity?.javaClass?.name,
                parent_fragment = f.parentFragment?.javaClass?.name,
                class_name = f.javaClass.name,
                tag = f.tag,
            ),
        )
    }

    override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {
        signalProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.now(),
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.RESUMED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                parent_fragment = f.parentFragment?.javaClass?.name,
                tag = f.tag,
            ),
        )
    }

    override fun onFragmentPaused(fm: FragmentManager, f: Fragment) {
        signalProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.now(),
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.PAUSED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                parent_fragment = f.parentFragment?.javaClass?.name,
                tag = f.tag,
            ),
        )
    }

    override fun onFragmentDetached(fm: FragmentManager, f: Fragment) {
        signalProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.now(),
            data = FragmentLifecycleData(
                type = FragmentLifecycleType.DETACHED,
                parent_activity = f.activity?.javaClass?.name,
                class_name = f.javaClass.name,
                parent_fragment = f.parentFragment?.javaClass?.name,
                tag = f.tag,
            ),
        )
    }
}
