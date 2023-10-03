package sh.measure.android.anr

import android.content.Context
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import sh.measure.android.events.EventTracker
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger

class AnrCollectorTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private val eventTracker = mock<EventTracker>()
    private val context = mock<Context>()

    @Test
    fun `AnrCollector tracks exception using event tracker, when ANR is detected`() {
        val anrCollector = AnrCollector(logger, context, timeProvider, eventTracker)
        val thread = Thread.currentThread()
        val message = "ANR"
        val timestamp = timeProvider.currentTimeSinceEpochInMillis
        val anrError = AnrError(thread, timestamp, message)

        // When
        anrCollector.onAppNotResponding(anrError)

        // Then
        verify(eventTracker).trackUnhandledException(
            ExceptionFactory.createMeasureException(
                throwable = anrError,
                handled = false,
                timestamp = anrError.timestamp,
                thread = thread,
                isAnr = true
            )
        )
    }
}