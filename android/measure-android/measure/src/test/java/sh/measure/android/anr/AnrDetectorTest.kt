package sh.measure.android.anr

import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import sh.measure.android.NativeBridge

class AnrDetectorTest {
    private val nativeBridge = mock<NativeBridge>()
    private val mainThreadProbe = FakeMainThreadProbe()
    private val anrListener = RecordingAnrListener()
    private val anrDetector = AnrDetector(nativeBridge, mainThreadProbe, anrListener)

    @Test
    fun `register enables anr reporting and registers itself as listener`() {
        anrDetector.register()
        verify(nativeBridge).enableAnrReporting(listener = anrDetector)
    }

    @Test
    fun `unregister disables anr reporting`() {
        anrDetector.register()
        verify(nativeBridge).enableAnrReporting(any())
        anrDetector.unregister()
        verify(nativeBridge).disableAnrReporting()
    }

    @Test
    fun `reports one anr for every signal of a single stall`() {
        // The system collects stacks once per deadline it trips, and each collection
        // raises SIGQUIT, so one stalled main thread arrives as several signals.
        anrDetector.onSigquit(1000)
        anrDetector.onSigquit(7000)
        anrDetector.onSigquit(13000)

        assertEquals(listOf(1000L), anrListener.timestamps)
    }

    @Test
    fun `reports again once the main thread recovers`() {
        anrDetector.onSigquit(1000)
        mainThreadProbe.runPending()

        anrDetector.onSigquit(60000)

        assertEquals(listOf(1000L, 60000L), anrListener.timestamps)
    }

    @Test
    fun `unregister clears the stall so a later signal reports`() {
        anrDetector.register()
        anrDetector.onSigquit(1000)
        anrDetector.unregister()

        anrDetector.onSigquit(60000)

        assertEquals(listOf(1000L, 60000L), anrListener.timestamps)
    }

    private class FakeMainThreadProbe : MainThreadProbe {
        private var pending: (() -> Unit)? = null

        override fun notifyWhenResponsive(callback: () -> Unit) {
            pending = callback
        }

        fun runPending() {
            val callback = pending
            pending = null
            callback?.invoke()
        }
    }

    private class RecordingAnrListener : AnrListener {
        val timestamps = mutableListOf<Long>()

        override fun onAnr(timestamp: Long) {
            timestamps.add(timestamp)
        }
    }
}
