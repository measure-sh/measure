package sh.measure.android.anr

import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import sh.measure.android.events.Event
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.SystemServiceProvider

class AnrCollectorTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private val eventProcessor = mock<EventProcessor>()
    private val systemServiceProvider = mock<SystemServiceProvider>()

    @Test
    fun `AnrCollector tracks exception using event tracker, when ANR is detected`() {
        val anrCollector = AnrCollector(logger, systemServiceProvider, timeProvider, eventProcessor)
        val thread = Thread.currentThread()
        val message = "ANR"
        val timestamp = timeProvider.currentTimeSinceEpochInMillis
        val anrError = AnrError(thread, timestamp, message)

        // When
        anrCollector.onAppNotResponding(anrError)

        // Then
        verify(eventProcessor).trackAnr(
            Event(
                type = EventType.ANR,
                timestamp = anrError.timestamp,
                data = ExceptionFactory.createMeasureException(
                    throwable = anrError,
                    handled = false,
                    thread = thread,
                    foreground = false,
                ),
            ),
        )
    }
}
