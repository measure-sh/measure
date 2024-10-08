package sh.measure.android.tracing

import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.RandomIdProvider

class MsrSpanBuilderTest {
    private val logger = NoopLogger()
    private val timeProvider = FakeTimeProvider()
    private val idProvider = RandomIdProvider()

    @Test
    fun `starts a span with explicitly set time`() {
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
    fun `starts a span without explicitly set time`() {
        // Given
        val spanName = "span-name"
        val startTime: Long = 1000
        timeProvider.fakeCurrentTimeSinceEpochInMillis = startTime

        // When
        val span = MsrSpanBuilder(spanName, idProvider, timeProvider, logger).startSpan().end()

        // Then
        assertEquals(startTime, span.toSpanData().startTime)
    }

    @Test
    fun `set parent span id manually`() {
        // Given
        val spanName = "span-name"
        val parentSpan = MsrSpan.startSpan("parent-span", logger, timeProvider, idProvider, null)

        // When
        val childSpan = MsrSpanBuilder(spanName, idProvider, timeProvider, logger)
            .setParent(parentSpan)
            .startSpan()
            .end()

        // Then
        assertEquals(parentSpan.spanId, childSpan.toSpanData().parentId)
    }

    @Test
    fun `set parent span id using current span in scope`() {
        // Given
        val parentSpan = MsrSpan.startSpan("parent-span", logger, timeProvider, idProvider, null)
        parentSpan.with {
            // When
            val childSpan = MsrSpanBuilder("child-span", idProvider, timeProvider, logger)
                .startSpan()
                .end()

            // Then
            assertEquals(parentSpan.spanId, childSpan.toSpanData().parentId)
        }
    }

    @Test
    fun `set no parent does not set parent using current span in scope`() {
        // Given
        val parentSpan = MsrSpan.startSpan("parent-span", logger, timeProvider, idProvider, null)
        parentSpan.with {
            // When
            val childSpan = MsrSpanBuilder("child-span", idProvider, timeProvider, logger)
                .setNoParent()
                .startSpan()
                .end()

            // Then
            assertEquals(null, childSpan.toSpanData().parentId)
        }
    }

    @Test
    fun `when parent is set manually, it takes precedence over current span in scope`() {
        // Given
        val span = MsrSpan.startSpan("parent-span", logger, timeProvider, idProvider, null)
        span.with {
            val expectedParent =
                MsrSpan.startSpan("actual-parent", logger, timeProvider, idProvider, null)

            // When
            val childSpan = MsrSpanBuilder("child-span", idProvider, timeProvider, logger)
                .setParent(expectedParent)
                .startSpan()
                .end()

            // Then
            assertEquals(expectedParent.spanId, childSpan.toSpanData().parentId)
        }
    }
}
