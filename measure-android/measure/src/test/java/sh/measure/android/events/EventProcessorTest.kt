package sh.measure.android.events

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.exporter.ExceptionExporter
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent
import sh.measure.android.fakes.FakeEventStore
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.screenshot.Screenshot
import sh.measure.android.screenshot.ScreenshotCollector
import sh.measure.android.utils.iso8601Timestamp

internal class EventProcessorTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val idProvider = FakeIdProvider()
    private val sessionManager = FakeSessionManager()
    private val eventStore = FakeEventStore()
    private val exceptionExporter = mock<ExceptionExporter>()
    private val screenshotCollector = mock<ScreenshotCollector>()
    private val config = FakeConfigProvider()
    private val eventTransformer = object : EventTransformer {
        override fun <T> transform(event: Event<T>): Event<T> = event
    }

    private val eventProcessor = EventProcessorImpl(
        logger = NoopLogger(),
        executorService = executorService,
        eventStore = eventStore,
        idProvider = idProvider,
        sessionManager = sessionManager,
        attributeProcessors = emptyList(),
        exceptionExporter = exceptionExporter,
        screenshotCollector = screenshotCollector,
        configProvider = config,
        eventTransformer = eventTransformer,
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
            sessionId = sessionManager.getSessionId(),
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
            sessionId = sessionManager.getSessionId(),
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
            sessionId = sessionManager.getSessionId(),
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
            exceptionExporter = exceptionExporter,
            screenshotCollector = screenshotCollector,
            configProvider = config,
            eventTransformer = eventTransformer,
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
            sessionId = sessionManager.getSessionId(),
            attributes = mutableMapOf("key" to "value"),
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        assertEquals(1, eventStore.trackedEvents.size)
        assertEquals(expectedEvent, eventStore.trackedEvents.first())
    }

    @Test
    fun `given an event of type exception, stores and triggers export`() {
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
        verify(exceptionExporter).export()
    }

    @Test
    fun `given an event of type ANR, stores and triggers export`() {
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
        verify(exceptionExporter).export()
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

    @Test
    fun `given transformer drops event, then does not store event`() {
        // Given
        val exceptionData = FakeEventFactory.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        val eventTransformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T>? = null
        }
        val eventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            idProvider = idProvider,
            sessionManager = sessionManager,
            attributeProcessors = emptyList(),
            exceptionExporter = exceptionExporter,
            screenshotCollector = screenshotCollector,
            configProvider = config,
            eventTransformer = eventTransformer,
        )

        // When
        eventProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )
        eventProcessor.track(
            data = "data",
            timestamp = timestamp,
            type = EventType.STRING,
        )

        // Then
        assertEquals(0, eventStore.trackedEvents.size)
    }

    @Test
    fun `given transformer modifies event, then stores modified event`() {
        // Given
        val activityLifecycleData = FakeEventFactory.getActivityLifecycleData(intent = "intent-data")
        val timestamp = 9856564654L
        val type = EventType.LIFECYCLE_ACTIVITY

        val eventTransformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                // drop the intent data from the event
                (event.data as ActivityLifecycleData).intent = null
                return event
            }
        }
        val eventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            idProvider = idProvider,
            sessionManager = sessionManager,
            attributeProcessors = emptyList(),
            exceptionExporter = exceptionExporter,
            screenshotCollector = screenshotCollector,
            configProvider = config,
            eventTransformer = eventTransformer,
        )

        // When
        eventProcessor.track(
            data = activityLifecycleData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, eventStore.trackedEvents.size)
        // verify intent data is dropped from the event
        assertNull((eventStore.trackedEvents.first().data as ActivityLifecycleData).intent)
    }
}
