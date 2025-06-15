package sh.measure.android.tracing

import org.junit.Assert
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.events.SignalProcessorImpl
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

class MsrSpanProcessorTest {
    private val signalProcessor = mock<SignalProcessorImpl>()
    private val logger = NoopLogger()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val configProvider = FakeConfigProvider()

    @Test
    fun `onStart appends thread name and onEnded appends attributes to spans`() {
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key"] = "value"
            }
        }
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, listOf(attributeProcessor), configProvider)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor,
            parentId = null,
        )

        // appends thread name
        spanProcessor.onStart(span)
        Assert.assertEquals(1, span.toSpanData().attributes.size)
        Assert.assertEquals(Attribute.THREAD_NAME, span.toSpanData().attributes.keys.first())

        span.end()

        // appends attributes
        Assert.assertEquals(span.toSpanData().attributes.size, 2)
        Assert.assertEquals(span.toSpanData().attributes["key"], "value")
    }

    @Test
    fun `onStart adds thread name to attributes`() {
        val spanProcessor = MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor,
            parentId = null,
        )
        spanProcessor.onStart(span)

        val attributes = span.toSpanData().attributes
        Assert.assertEquals(1, attributes.size)
        Assert.assertEquals(Thread.currentThread().name, attributes[Attribute.THREAD_NAME])
    }

    @Test
    fun `onEnded delegates to event processor`() {
        val spanProcessor = MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor,
            startTime = timeProvider.now() - 1000,
        ).end() as MsrSpan

        verify(signalProcessor).trackSpan(span.toSpanData())
    }

    @Test
    fun `discards span if it exceeds max length`() {
        val spanProcessor = MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider)
        TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            name = "s".repeat(configProvider.maxSpanNameLength + 1),
        ).end() as MsrSpan

        verify(signalProcessor, never()).trackSpan(any())
    }

    @Test
    fun `discards checkpoint if checkpoint name exceeds max length`() {
        val spanProcessor = MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
        ).end() as MsrSpan
        span.setCheckpoint(name = "s".repeat(configProvider.maxCheckpointNameLength + 1))

        Assert.assertEquals(0, span.checkpoints.size)
    }

    @Test
    fun `discards checkpoints to keep them within max checkpoints per span limit`() {
        val spanProcessor = MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
        )
        for (i in 0..configProvider.maxCheckpointsPerSpan) {
            span.setCheckpoint(name = "checkpoint")
        }
        span.end()

        Assert.assertEquals(configProvider.maxCheckpointsPerSpan, span.checkpoints.size)
    }

    @Test
    fun `discards span if duration is negative`() {
        val spanProcessor = MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            startTime = timeProvider.now() + 1000,
        ).end() as MsrSpan
        for (i in 0..configProvider.maxCheckpointsPerSpan) {
            span.setCheckpoint(name = "checkpoint")
        }

        verify(signalProcessor, never()).trackSpan(any())
    }
}
