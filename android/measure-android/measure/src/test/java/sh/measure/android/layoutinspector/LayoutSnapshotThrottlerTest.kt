package sh.measure.android.layoutinspector

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import java.time.Duration

class LayoutSnapshotThrottlerTest {
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val throttler = LayoutSnapshotThrottler(timeProvider)

    @Test
    fun `allows the first snapshot`() {
        assertTrue(throttler.shouldTakeSnapshot())
    }

    @Test
    fun `blocks a snapshot taken too soon after the previous one`() {
        throttler.shouldTakeSnapshot()
        assertFalse(throttler.shouldTakeSnapshot())
    }

    @Test
    fun `allows a snapshot once the delay has elapsed`() {
        throttler.shouldTakeSnapshot()
        testClock.advance(Duration.ofMillis(751))
        assertTrue(throttler.shouldTakeSnapshot())
    }

    @Test
    fun `respects a custom delay`() {
        throttler.shouldTakeSnapshot(delayMs = 100)
        testClock.advance(Duration.ofMillis(50))
        assertFalse(throttler.shouldTakeSnapshot(delayMs = 100))
        testClock.advance(Duration.ofMillis(101))
        assertTrue(throttler.shouldTakeSnapshot(delayMs = 100))
    }
}
