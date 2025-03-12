package sh.measure.android.tracing

import org.junit.Assert
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.verify
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.FakeTraceSampler
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.IdProviderImpl
import sh.measure.android.utils.RandomizerImpl
import sh.measure.android.utils.TestClock
import java.time.Duration

class MsrSpanTest {
    private val logger = NoopLogger()
    private val testClock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(testClock)
    private val idProvider = IdProviderImpl(randomizer = RandomizerImpl())
    private val spanProcessor = mock<SpanProcessor>()
    private val sessionManager = FakeSessionManager()
    private val traceSampler = FakeTraceSampler()

    @Test
    fun `startSpan sets parent span if provided`() {
        val parentSpan = MsrSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            isSampled = true,
            name = "parent-span",
            spanId = "span-id",
            traceId = "trace-id",
            parentId = null,
            sessionId = sessionManager.getSessionId(),
            startTime = 1000,
        )
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
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
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
            timestamp = null,
        ) as MsrSpan
        Assert.assertEquals(epochTime, span.startTime)
    }

    @Test
    fun `startSpan sets timestamp if provided`() {
        val timestamp = 10000L
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
            timestamp = timestamp,
        ) as MsrSpan
        Assert.assertEquals(timestamp, span.startTime)
    }

    @Test
    fun `startSpan triggers span processor onStart`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ) as MsrSpan

        verify(spanProcessor, times(1)).onStart(span)
    }

    @Test
    fun `default span status is unset`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ) as MsrSpan
        Assert.assertEquals(SpanStatus.Unset, span.getStatus())
    }

    @Test
    fun `setStatus updates the span status`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ).setStatus(SpanStatus.Ok) as MsrSpan
        Assert.assertEquals(SpanStatus.Ok, span.getStatus())
    }

    @Test
    fun `setName updates the span name`() {
        val span = MsrSpan.startSpan(
            "initial-span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ).setName("updated-span-name") as MsrSpan
        Assert.assertEquals("updated-span-name", span.name)
    }

    @Test
    fun `hasEnded for active span`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
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
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
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
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )
        testClock.advance(Duration.ofMillis(1000))
        val duration = span.end().getDuration()

        Assert.assertEquals(1000, duration)
    }

    @Test
    fun `end triggers span processor onEnding and onEnded`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ).end() as MsrSpan

        spanProcessor.inOrder {
            verify().onEnding(span)
            verify().onEnded(span)
        }
    }

    @Test
    fun `setCheckpoint adds checkpoint to span`() {
        val expectedCheckpoint = Checkpoint("name", timeProvider.now())
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ) as MsrSpan
        span.setCheckpoint(expectedCheckpoint.name)

        Assert.assertEquals(1, span.checkpoints.size)
        Assert.assertEquals(expectedCheckpoint, span.checkpoints.first())
    }

    @Test
    fun `setEvent on ended span is a no-op`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ).end() as MsrSpan
        span.setCheckpoint("event-id")

        Assert.assertEquals(0, span.checkpoints.size)
    }

    @Test
    fun `setAttribute adds attribute to span`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ) as MsrSpan
        span.setAttribute("key", "value")

        Assert.assertEquals("value", span.getUserDefinedAttrs()["key"])
    }

    @Test
    fun `setAttribute on ended span is a no-op`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ).end() as MsrSpan
        span.setAttribute("key", "value")

        Assert.assertEquals(0, span.attributes.size)
    }

    @Test
    fun `setAttributes adds multiple attributes to span`() {
        val attributes = AttributesBuilder().put("key1", "value1").put("key2", "value2").build()
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ) as MsrSpan
        span.setAttributes(attributes)

        Assert.assertEquals("value1", span.getUserDefinedAttrs()["key1"])
        Assert.assertEquals("value2", span.getUserDefinedAttrs()["key2"])
    }

    @Test
    fun `removeAttribute removes attribute from span`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        ) as MsrSpan
        span.setAttribute("key", "value")
        span.removeAttribute("key")

        Assert.assertEquals(0, span.getUserDefinedAttrs().size)
    }

    @Test
    fun `duration is 0 for active span`() {
        val span = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )
        testClock.advance(Duration.ofMillis(1000))
        val duration = span.getDuration()

        Assert.assertEquals(0, duration)
    }

    @Test
    fun `startSpan sets sampling state for root span based on trace sampler`() {
        traceSampler.setSampled(true)
        val span1 = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )
        Assert.assertTrue(span1.isSampled)

        traceSampler.setSampled(false)
        val span2 = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )
        Assert.assertFalse(span2.isSampled)
    }

    @Test
    fun `startSpan samples child span if parent span is sampled`() {
        traceSampler.setSampled(true)
        val sampledParentSpan = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )
        traceSampler.setSampled(false)
        val childSpan = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = sampledParentSpan,
        )

        Assert.assertTrue(childSpan.isSampled)
    }

    @Test
    fun `startSpan does not sample child span if parent span is not sampled`() {
        traceSampler.setSampled(false)
        val unsampledParentSpan = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )
        traceSampler.setSampled(true)
        val childSpan = MsrSpan.startSpan(
            "span-name",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = unsampledParentSpan,
        )

        Assert.assertFalse(childSpan.isSampled)
    }

    @Test
    fun `startSpan initializes parent ID and trace ID correctly`() {
        val parentSpan = MsrSpan.startSpan(
            "parent-span",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )
        val childSpan = MsrSpan.startSpan(
            "child-span",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = parentSpan,
        )

        Assert.assertEquals(parentSpan.traceId, childSpan.traceId)
        Assert.assertEquals(parentSpan.spanId, childSpan.parentId)
    }

    @Test
    fun `setParent updates parent ID and trace ID correctly`() {
        val parentSpan = MsrSpan.startSpan(
            "parent-span",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )
        val childSpan = MsrSpan.startSpan(
            "child-span",
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            traceSampler = traceSampler,
            idProvider = idProvider,
            parentSpan = null,
        )

        childSpan.setParent(parentSpan)

        Assert.assertEquals(parentSpan.traceId, childSpan.traceId)
        Assert.assertEquals(parentSpan.spanId, childSpan.parentId)
    }
}
