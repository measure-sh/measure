package sh.measure.android.tracing

import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger

class MsrSpanBuilderTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private val idProvider = FakeIdProvider()

    @Test
    fun `starts a span with time`() {
        // Given
        val spanName = "span-name"
        val startTime: Long = 1000

        // When
        val span =
            MsrSpanBuilder(spanName, idProvider, timeProvider, logger).startSpan(startTime).end()

        // Then
        assertEquals(startTime, span.toSpanData().startTime)
    }

    @Test
    fun `starts a span without time`() {
        // Given
        val spanName = "span-name"
        val startTime: Long = 1000
        timeProvider.fakeCurrentTimeSinceEpochInMillis = startTime

        // When
        val span = MsrSpanBuilder(spanName, idProvider, timeProvider, logger).startSpan().end()

        // Then
        assertEquals(startTime, span.toSpanData().startTime)
    }
}
