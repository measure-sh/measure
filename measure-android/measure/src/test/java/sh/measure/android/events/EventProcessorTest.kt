package sh.measure.android.events

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.exporter.EventExporter
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent
import sh.measure.android.fakes.FakeEventStore
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.screenshot.Screenshot
import sh.measure.android.screenshot.ScreenshotCollector
import sh.measure.android.utils.iso8601Timestamp

internal class EventProcessorTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val idProvider = FakeIdProvider()
    private val sessionManager = FakeSessionManager()
    private val eventStore = FakeEventStore()
    private val eventExporter = mock<EventExporter>()
    private val screenshotCollector = mock<ScreenshotCollector>()
    private val config = FakeConfigProvider()

    private val eventProcessor = EventProcessorImpl(
        logger = NoopLogger(),
        executorService = executorService,
        eventStore = eventStore,
        idProvider = idProvider,
        sessionManager = sessionManager,
        attributeProcessors = emptyList(),
        eventExporter = eventExporter,
        screenshotCollector = screenshotCollector,
        configProvider = config,
    )

    @Before
    fun setUp() {
        config.trackScreenshotOnCrash = false
    }

    @Test
    fun `given an event, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        val expectedEvent = exceptionData.toEvent(
            type = type,
            timestamp = timestamp.iso8601Timestamp(),
            id = idProvider.id,
            sessionId = sessionManager.sessionId,
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }

    @Test
    fun `given event with attachments, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val attachments = mutableListOf(FakeEventFactory.getAttachment())

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            attachments = attachments,
        )

        val expectedEvent = exceptionData.toEvent(
            type = type,
            timestamp = timestamp.iso8601Timestamp(),
            id = idProvider.id,
            sessionId = sessionManager.sessionId,
            attachments = attachments,
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }

    @Test
    fun `given event with attributes, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val attributes: MutableMap<String, Any?> = mutableMapOf("key" to "value")

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            attributes = attributes,
        )

        val expectedEvent = exceptionData.toEvent(
            type = type,
            timestamp = timestamp.iso8601Timestamp(),
            id = idProvider.id,
            sessionId = sessionManager.sessionId,
            attributes = attributes,
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }

    @Test
    fun `given attribute processors are provided, applies them to the event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key"] = "value"
            }
        }
        val eventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            idProvider = idProvider,
            sessionManager = sessionManager,
            attributeProcessors = listOf(attributeProcessor),
            eventExporter = eventExporter,
            screenshotCollector = screenshotCollector,
            configProvider = config,
        )

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        val expectedEvent = exceptionData.toEvent(
            type = type,
            timestamp = timestamp.iso8601Timestamp(),
            id = idProvider.id,
            sessionId = sessionManager.sessionId,
            attributes = mutableMapOf("key" to "value"),
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }

    @Test
    fun `given an event of type exception, stores and exports the event immediately`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, eventStore.trackedEvents.size)
        verify(eventExporter).export(eventStore.trackedEvents.first())
    }

    @Test
    fun `given an event of type ANR, stores and exports the event immediately`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, eventStore.trackedEvents.size)
        verify(eventExporter).export(eventStore.trackedEvents.first())
    }

    @Test
    fun `given an event of type exception and config to capture screenshot, adds screenshot as attachment`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        config.trackScreenshotOnCrash = true
        val screenshot = Screenshot(data = byteArrayOf(1, 2, 3, 4), extension = "png")
        `when`(screenshotCollector.takeScreenshot()).thenReturn(screenshot)

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, eventStore.trackedEvents.size)
        val attachments = eventStore.trackedEvents.first().attachments
        assertEquals(1, attachments.size)
        assertEquals("screenshot.png", attachments.first().name)
        assertTrue(screenshot.data.contentEquals(attachments.first().bytes))
    }

    @Test
    fun `given an event of type exception and config to not capture screenshot, does not add screenshot as attachment`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        config.trackScreenshotOnCrash = false

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, eventStore.trackedEvents.size)
        val attachments = eventStore.trackedEvents.first().attachments
        assertEquals(0, attachments.size)
    }

    @Test
    fun `given an event of type ANR and config to capture screenshot, does not add screenshot as attachment`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR
        config.trackScreenshotOnCrash = true

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, eventStore.trackedEvents.size)
        val attachments = eventStore.trackedEvents.first().attachments
        assertEquals(0, attachments.size)
    }

    @Test
    fun `given an event of type ANR and config to not capture screenshot, does not add screenshot as attachment`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR
        config.trackScreenshotOnCrash = false

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, eventStore.trackedEvents.size)
        val attachments = eventStore.trackedEvents.first().attachments
        assertEquals(0, attachments.size)
    }
}
