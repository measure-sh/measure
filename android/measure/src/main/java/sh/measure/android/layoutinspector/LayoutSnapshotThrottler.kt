package sh.measure.android.layoutinspector

import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicLong

/**
 * Controls the frequency of layout snapshots by enforcing a minimum time interval between captures.
 */
internal class LayoutSnapshotThrottler(private val timeProvider: TimeProvider) {
    private val lastSnapshotAttemptTimestamp = AtomicLong(0)

    /**
     * Determines whether a new snapshot should be taken based on the elapsed time since the
     * last attempt.
     *
     * @param delayMs The required delay between snapshots in milliseconds.
     * @return `true` if enough time has elapsed since the last snapshot or if this is the
     *          first snapshot, false` if the delay hasn't been met.
     */
    fun shouldTakeSnapshot(delayMs: Int = 750): Boolean {
        val now = timeProvider.now()
        val previous = lastSnapshotAttemptTimestamp.getAndSet(now)
        return previous == 0L || (now - previous) > delayMs
    }
}
