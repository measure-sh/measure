package sh.measure.android.lifecycle

import android.content.Context
import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import curtains.onNextDraw
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.mainHandler
import sh.measure.android.postAtFrontOfQueueAsync
import sh.measure.android.tracing.CheckpointName
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanName
import sh.measure.android.tracing.SpanStatus
import sh.measure.android.tracing.Tracer
import sh.measure.android.utils.TimeProvider

/**
 * Tracks [Fragment] lifecycle events.
 */
internal class FragmentLifecycleCollector(
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val tracer: Tracer,
) : FragmentLifecycleAdapter() {
    private val attachedFragmentSpans = mutableMapOf<String, Span?>()

    override fun onFragmentAttached(fm: FragmentManager, f: Fragment, context: Context) {
        startFragmentTtidSpan(f)
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

    override fun onFragmentViewCreated(
        fm: FragmentManager,
        f: Fragment,
        v: View,
        savedInstanceState: Bundle?,
    ) {
        if (savedInstanceState == null) {
            endFragmentTtidSpan(f)
        } else {
            // Only track Fragment TTID spans for first time launch,
            // This case would occur due to a configuration change and is does not
            // require the TTID to be reported.
            val identityHash = getIdentityHash(f)
            attachedFragmentSpans.remove(identityHash)
        }
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
        val identityHash = getIdentityHash(f)
        attachedFragmentSpans.remove(identityHash)
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

    private fun startFragmentTtidSpan(f: Fragment) {
        if (!configProvider.trackFragmentLoadTime) {
            return
        }
        val identityHash = getIdentityHash(f)
        val fragmentTtidSpan = tracer.spanBuilder(
            SpanName.fragmentTtidSpan(
                f.javaClass.name,
                configProvider.maxSpanNameLength,
            ),
        ).startSpan()
            .setCheckpoint(CheckpointName.FRAGMENT_ATTACHED)
        attachedFragmentSpans[identityHash] = fragmentTtidSpan
    }

    private fun endFragmentTtidSpan(f: Fragment) {
        val identityHash = getIdentityHash(f)
        val fragmentTtidSpan = attachedFragmentSpans[identityHash]?.setCheckpoint(
            CheckpointName.FRAGMENT_RESUMED,
        )
        f.activity?.window?.onNextDraw {
            mainHandler.postAtFrontOfQueueAsync {
                fragmentTtidSpan?.setStatus(SpanStatus.Ok)?.end()
                attachedFragmentSpans.remove(identityHash)
            }
        }
    }

    private fun getIdentityHash(fragment: Fragment): String {
        return Integer.toHexString(System.identityHashCode(fragment))
    }
}
