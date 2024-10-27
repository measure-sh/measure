package sh.measure.android.tracing

import org.junit.Assert
import org.junit.Test
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import sh.measure.android.utils.UUIDProvider
import java.time.Duration

class MsrSpanTest {
    private val logger = NoopLogger()
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val idProvider = UUIDProvider()

    @Test
    fun `startSpan sets parent span if provided`() {
        val parentSpan = MsrSpan(
            logger,
            timeProvider,
            "parent-span",
            "span-id",
            "trace-id",
            parentId = null,
            startTime = 1000,
        )
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = parentSpan,
            timestamp = null,
        )

        Assert.assertEquals(parentSpan.spanId, span.parentId)
    }

    @Test
    fun `startSpan sets current timestamp`() {
        val epochTime = testClock.epochTime()
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = null,
            timestamp = null,
        )
        Assert.assertEquals(epochTime, span.startTime)
    }

    @Test
    fun `startSpan sets timestamp if provided`() {
        val timestamp = 10000L
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = null,
            timestamp = timestamp,
        )
        Assert.assertEquals(timestamp, span.startTime)
    }

    @Test
    fun `default span status is unset`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = null,
        )
        Assert.assertEquals(SpanStatus.Unset, span.getStatus())
    }

    @Test
    fun `setStatus updates the span status`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = null,
        ).setStatus(SpanStatus.Ok)
        Assert.assertEquals(SpanStatus.Ok, span.getStatus())
    }

    @Test
    fun `hasEnded for active span`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = null,
        )
        Assert.assertEquals(false, span.hasEnded())
    }

    @Test
    fun `hasEnded for ended span`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = null,
        ).end()
        Assert.assertEquals(true, span.hasEnded())
    }

    @Test
    fun `end updates the span duration`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = null,
        )
        testClock.advance(Duration.ofMillis(1000))
        val duration = span.end().getDuration()

        Assert.assertEquals(1000, duration)
    }

    @Test
    fun `duration is 0 for active span`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = null,
        )
        testClock.advance(Duration.ofMillis(1000))
        val duration = span.getDuration()

        Assert.assertEquals(0, duration)
    }
}
