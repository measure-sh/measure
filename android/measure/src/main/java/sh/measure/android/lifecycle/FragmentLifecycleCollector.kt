package sh.measure.android.lifecycle

import android.content.Context
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.utils.TimeProvider

/**
 * Tracks [Fragment] lifecycle events.
 *
 * It filters out "androidx.navigation.fragment.NavHostFragment", as it's not useful for tracking.
 * The journey graph feature relies on this filtering to avoid showing NavHostFragment in the graph.
 */
internal class FragmentLifecycleCollector(
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
) : FragmentLifecycleAdapter() {
    override fun onFragmentAttached(fm: FragmentManager, f: Fragment, context: Context) {
        if (isNavHostFragment(f)) {
            return
        }
        val data = FragmentLifecycleData(
            type = FragmentLifecycleType.ATTACHED,
            parent_activity = f.activity?.javaClass?.name,
            parent_fragment = getParentFragmentName(f),
            class_name = f.javaClass.name,
            tag = f.tag,
        )
        eventProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = data,
        )
    }

    override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {
        if (isNavHostFragment(f)) {
            return
        }
        val data = FragmentLifecycleData(
            type = FragmentLifecycleType.RESUMED,
            parent_activity = f.activity?.javaClass?.name,
            parent_fragment = f.parentFragment?.javaClass?.name,
            class_name = f.javaClass.name,
            tag = f.tag,
        )
        eventProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = data,
        )
    }

    override fun onFragmentPaused(fm: FragmentManager, f: Fragment) {
        if (isNavHostFragment(f)) {
            return
        }
        val data = FragmentLifecycleData(
            type = FragmentLifecycleType.PAUSED,
            parent_activity = f.activity?.javaClass?.name,
            parent_fragment = f.parentFragment?.javaClass?.name,
            class_name = f.javaClass.name,
            tag = f.tag,
        )
        eventProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = data,
        )
    }

    override fun onFragmentDetached(fm: FragmentManager, f: Fragment) {
        if (isNavHostFragment(f)) {
            return
        }
        val data = FragmentLifecycleData(
            type = FragmentLifecycleType.DETACHED,
            parent_activity = f.activity?.javaClass?.name,
            parent_fragment = f.parentFragment?.javaClass?.name,
            class_name = f.javaClass.name,
            tag = f.tag,
        )
        eventProcessor.track(
            type = EventType.LIFECYCLE_FRAGMENT,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = data,
        )
    }

    private fun getParentFragmentName(f: Fragment): String? {
        val name = f.parentFragment?.javaClass?.name
        if (name == "androidx.navigation.fragment.NavHostFragment") {
            // Ignore NavHostFragment which is added by androidx.navigation. It's not a
            // "real" parent fragment and is not useful for tracking.
            return null
        }
        return name
    }

    private fun isNavHostFragment(f: Fragment): Boolean {
        return f.javaClass.name == "androidx.navigation.fragment.NavHostFragment"
    }
}
