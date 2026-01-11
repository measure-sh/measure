package sh.measure.android.tracing

import org.junit.Assert
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.kotlin.any
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.StringAttr
import sh.measure.android.events.SignalProcessorImpl
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeSampler
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

class MsrSpanProcessorTest {
    private val signalProcessor = mock<SignalProcessorImpl>()
    private val logger = NoopLogger()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val configProvider = FakeConfigProvider()
    private val sampler = FakeSampler()

    @Test
    fun `onStart appends attributes to spans`() {
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key"] = "value"
            }
        }
        val spanProcessor =
            MsrSpanProcessor(
                logger,
                signalProcessor,
                listOf(attributeProcessor),
                configProvider,
                sampler,
            )
        spanProcessor.onConfigLoaded()

        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor,
            parentId = null,
        )
        spanProcessor.onStart(span)

        // thread name is always added as an attribute, hence size is 2
        Assert.assertEquals(2, span.toSpanData().attributes.size)
        Assert.assertEquals("value", span.toSpanData().attributes["key"])
    }

    @Test
    fun `onStart adds thread name to attributes`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

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
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor,
            startTime = timeProvider.now() - 1000,
        ).end() as MsrSpan

        verify(signalProcessor).trackSpan(span.toSpanData())
    }

    @Test
    fun `discards span if name is empty`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

        TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            name = "",
        ).end()

        TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            name = "    ",
        ).end()

        verify(signalProcessor, never()).trackSpan(any())
    }

    @Test
    fun `discards span if it exceeds max length`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

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
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

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
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
        )
        (0..configProvider.maxCheckpointsPerSpan).forEach { i ->
            span.setCheckpoint(name = "checkpoint")
        }
        span.end()

        Assert.assertEquals(configProvider.maxCheckpointsPerSpan, span.checkpoints.size)
    }

    @Test
    fun `discards span if duration is negative`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

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

    @Test
    fun `discards attributes if key exceeds max length`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            startTime = timeProvider.now() - 1000,
        )
        span.setAttribute("k".repeat(configProvider.maxUserDefinedAttributeKeyLength + 1), "value")
        span.setAttribute("valid-key", "value")
        span.end()

        val spanData = span.toSpanData()
        Assert.assertEquals(1, spanData.userDefinedAttrs.size)
        Assert.assertEquals("value", spanData.userDefinedAttrs["valid-key"])
    }

    @Test
    fun `discards attributes if value exceeds max length`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            startTime = timeProvider.now() - 1000,
        )
        span.setAttribute("invalid-value", "v".repeat(configProvider.maxUserDefinedAttributeValueLength + 1))
        span.setAttribute("valid-key", "value")
        span.end()

        val spanData = span.toSpanData()
        Assert.assertEquals(1, spanData.userDefinedAttrs.size)
        Assert.assertEquals("value", spanData.userDefinedAttrs["valid-key"])
    }

    @Test
    fun `discards attributes to keep them within max attributes per span limit`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        spanProcessor.onConfigLoaded()

        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            startTime = timeProvider.now() - 1000,
        )
        repeat(configProvider.maxUserDefinedAttributesPerEvent + 5) { i ->
            span.setAttribute("key-$i", "value-$i")
        }
        span.end()

        val spanData = span.toSpanData()
        Assert.assertEquals(configProvider.maxUserDefinedAttributesPerEvent, spanData.userDefinedAttrs.size)
    }

    @Test
    fun `onEnded buffers span when config not loaded`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            startTime = timeProvider.now() - 1000,
        ).end() as MsrSpan

        verify(signalProcessor, never()).trackSpan(span.toSpanData())
    }

    @Test
    fun `onEnded removes invalid span from buffer when config not loaded`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)

        // Create and end an invalid span (empty name) before config loads
        val invalidSpan = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            name = "",
            startTime = timeProvider.now() - 1000,
        )
        spanProcessor.onStart(invalidSpan)
        invalidSpan.end()

        // Load config - invalid span should already be removed from buffer
        spanProcessor.onConfigLoaded()

        verify(signalProcessor, never()).trackSpan(any())
    }

    @Test
    fun `onConfigLoaded processes buffered spans`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            startTime = timeProvider.now() - 1000,
        )
        spanProcessor.onStart(span)
        span.end()

        spanProcessor.onConfigLoaded()
        verify(signalProcessor).trackSpan(span.toSpanData())
    }

    @Test
    fun `onConfigLoaded sets sampling rate on buffered spans`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            startTime = timeProvider.now() - 1000,
            isSampled = false,
        )
        spanProcessor.onStart(span)
        span.end()

        sampler.setSampled(true)
        spanProcessor.onConfigLoaded()
        Assert.assertEquals(true, span.isSampled)
    }

    @Test
    fun `onConfigLoaded only processes buffered spans once`() {
        val spanProcessor =
            MsrSpanProcessor(logger, signalProcessor, emptyList(), configProvider, sampler)
        val span = TestData.getSpan(
            logger = logger,
            timeProvider = timeProvider,
            spanProcessor = spanProcessor,
            startTime = timeProvider.now() - 1000,
        )
        spanProcessor.onStart(span)
        span.end()

        spanProcessor.onConfigLoaded()
        spanProcessor.onConfigLoaded()

        verify(signalProcessor, times(1)).trackSpan(span.toSpanData())
    }
}
