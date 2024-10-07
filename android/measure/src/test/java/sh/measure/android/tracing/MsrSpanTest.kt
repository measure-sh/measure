package sh.measure.android.tracing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger

class MsrSpanTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private val idProvider = FakeIdProvider()

    @Test
    fun `start span with start time`() {
        // Given
        val spanName = "TestSpan"
        val startTime = 1000L

        // When
        val span = MsrSpan.startSpan(spanName, logger, timeProvider, idProvider, startTime)

        // Then
        val spanData = span.toSpanData()
        assertEquals(startTime, spanData.startTime)
    }

    @Test
    fun `start span without start time`() {
        // Given
        val spanName = "TestSpan"
        val startTime = 1000L
        timeProvider.fakeCurrentTimeSinceEpochInMillis = startTime

        // When
        val span = MsrSpan.startSpan(spanName, logger, timeProvider, idProvider)

        // Then
        val spanData = span.toSpanData()
        assertEquals(startTime, spanData.startTime)
    }

    @Test
    fun `start span creates an span id`() {
        // Given
        val spanName = "TestSpan"
        val spanId = "TestSpanId"
        idProvider.id = spanId

        // When
        val span = MsrSpan.startSpan(spanName, logger, timeProvider, idProvider)

        // Then
        val spanData = span.toSpanData()
        assertEquals(spanId, spanData.spanId)
    }

    @Test
    fun `end span with end time`() {
        // Given
        val spanName = "TestSpan"
        val startTime = 1000L
        val endTime = 2000L
        timeProvider.fakeCurrentTimeSinceEpochInMillis = startTime

        // When
        val span = MsrSpan.startSpan(spanName, logger, timeProvider, idProvider, startTime)
        span.end(endTime)

        // Then
        val spanData = span.toSpanData()
        assertEquals(endTime, spanData.endTime)
        assertTrue(spanData.hasEnded)
    }

    @Test
    fun `end span without end time`() {
        // Given
        val spanName = "TestSpan"
        val startTime = 1000L
        val elapsedTime = 100L
        val expectedEndTime = startTime + elapsedTime
        timeProvider.fakeCurrentTimeSinceEpochInMillis = startTime

        // When
        val span = MsrSpan.startSpan(spanName, logger, timeProvider, idProvider, startTime)
        timeProvider.fakeElapsedRealtime = elapsedTime
        span.end()

        // Then
        val spanData = span.toSpanData()
        assertEquals(expectedEndTime, spanData.endTime)
        assertTrue(spanData.hasEnded)
    }

    @Test
    fun `end span on an already ended span is a no-op`() {
        // Given
        val spanName = "TestSpan"
        val startTime = 1000L
        val endTime = 2000L
        timeProvider.fakeCurrentTimeSinceEpochInMillis = startTime

        // When
        val span = MsrSpan.startSpan(spanName, logger, timeProvider, idProvider, startTime)
        span.end(endTime)
        timeProvider.fakeElapsedRealtime = 100L
        span.end()

        // Then
        val spanData = span.toSpanData()
        assertEquals(endTime, spanData.endTime)
        assertTrue(spanData.hasEnded)
    }

    @Test
    fun `updates status of an active span`() {
        // Given
        val spanName = "TestSpan"
        val status = SpanStatus.Ok

        // When
        val span = MsrSpan.startSpan(spanName, logger, timeProvider, idProvider)
        span.setStatus(status)
        span.end()

        // Then
        val spanData = span.toSpanData()
        assertEquals(status, spanData.status)
    }

    @Test
    fun `does not update status of an ended span`() {
        // Given
        val spanName = "TestSpan"
        val status = SpanStatus.Ok

        // When
        val span = MsrSpan.startSpan(spanName, logger, timeProvider, idProvider)
        span.end()
        span.setStatus(status)

        // Then
        val spanData = span.toSpanData()
        assertEquals(SpanStatus.Unset, spanData.status)
    }
}
