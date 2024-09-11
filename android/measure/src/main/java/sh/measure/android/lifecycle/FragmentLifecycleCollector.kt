package sh.measure.android.lifecycle

import android.content.Context
import android.util.Log
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
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
        val data = FragmentLifecycleData(
            type = FragmentLifecycleType.ATTACHED,
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

    override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {
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
        Log.i("FragmentNavigation", Json.encodeToString(data))
    }

    override fun onFragmentPaused(fm: FragmentManager, f: Fragment) {
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
        Log.i("FragmentNavigation", Json.encodeToString(data))
    }

    override fun onFragmentDetached(fm: FragmentManager, f: Fragment) {
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
        Log.i("FragmentNavigation", Json.encodeToString(data))

    }
}
