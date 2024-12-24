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
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.FakeSignalStore
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.screenshot.Screenshot
import sh.measure.android.screenshot.ScreenshotCollector
import sh.measure.android.utils.iso8601Timestamp

internal class SignalProcessorTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val idProvider = FakeIdProvider()
    private val sessionManager = FakeSessionManager()
    private val signalStore = FakeSignalStore()
    private val exceptionExporter = mock<ExceptionExporter>()
    private val screenshotCollector = mock<ScreenshotCollector>()
    private val configProvider = FakeConfigProvider()
    private val eventTransformer = object : EventTransformer {
        override fun <T> transform(event: Event<T>): Event<T> = event
    }

    private val signalProcessor = SignalProcessorImpl(
        logger = NoopLogger(),
        ioExecutor = executorService,
        signalStore = signalStore,
        idProvider = idProvider,
        sessionManager = sessionManager,
        attributeProcessors = emptyList(),
        exceptionExporter = exceptionExporter,
        screenshotCollector = screenshotCollector,
        configProvider = configProvider,
        eventTransformer = eventTransformer,
    )

    @Before
    fun setUp() {
        configProvider.trackScreenshotOnCrash = false
    }

    @Test
    fun `given an event, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION

        // When
        signalProcessor.track(
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

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(expectedEvent, signalStore.trackedEvents.first())
    }

    @Test
    fun `given event with attachments, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val attachments = mutableListOf(TestData.getAttachment())

        // When
        signalProcessor.track(
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

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(expectedEvent, signalStore.trackedEvents.first())
    }

    @Test
    fun `given event with attributes, adds session id, event id and thread name as attribute, then stores event`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val attributes: MutableMap<String, Any?> = mutableMapOf("key" to "value")

        // When
        signalProcessor.track(
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

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(expectedEvent, signalStore.trackedEvents.first())
    }

    @Test
    fun `given attribute processors are provided, applies them to the event`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(attributes: MutableMap<String, Any?>) {
                attributes["key"] = "value"
            }
        }
        val signalProcessor = SignalProcessorImpl(
            logger = NoopLogger(),
            ioExecutor = executorService,
            signalStore = signalStore,
            idProvider = idProvider,
            sessionManager = sessionManager,
            attributeProcessors = listOf(attributeProcessor),
            exceptionExporter = exceptionExporter,
            screenshotCollector = screenshotCollector,
            configProvider = configProvider,
            eventTransformer = eventTransformer,
        )

        // When
        signalProcessor.track(
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

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(expectedEvent, signalStore.trackedEvents.first())
    }

    @Test
    fun `given an event of type exception, stores it, marks current session as crashed, and triggers export`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        // When
        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(sessionManager.getSessionId(), sessionManager.crashedSession)
        assertEquals(1, signalStore.trackedEvents.size)
        verify(exceptionExporter).export(sessionManager.getSessionId())
    }

    @Test
    fun `given an event of type ANR,  stores it, marks current session as crashed, and triggers export`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR

        // When
        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(sessionManager.getSessionId(), sessionManager.crashedSession)
        assertEquals(1, signalStore.trackedEvents.size)
        verify(exceptionExporter).export(sessionManager.getSessionId())
    }

    @Test
    fun `given an event of type exception and config to capture screenshot, adds screenshot as attachment`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        configProvider.trackScreenshotOnCrash = true
        val screenshot = Screenshot(data = byteArrayOf(1, 2, 3, 4), extension = "png")
        `when`(screenshotCollector.takeScreenshot()).thenReturn(screenshot)

        // When
        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, signalStore.trackedEvents.size)
        val attachments = signalStore.trackedEvents.first().attachments
        assertEquals(1, attachments.size)
        assertEquals("screenshot.png", attachments.first().name)
        assertTrue(screenshot.data.contentEquals(attachments.first().bytes))
    }

    @Test
    fun `given an event of type exception and config to not capture screenshot, does not add screenshot as attachment`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        configProvider.trackScreenshotOnCrash = false

        // When
        signalProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, signalStore.trackedEvents.size)
        val attachments = signalStore.trackedEvents.first().attachments
        assertEquals(0, attachments.size)
    }

    @Test
    fun `given an event of type ANR and config to capture screenshot, does not add screenshot as attachment`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR
        configProvider.trackScreenshotOnCrash = true

        // When
        signalProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, signalStore.trackedEvents.size)
        val attachments = signalStore.trackedEvents.first().attachments
        assertEquals(0, attachments.size)
    }

    @Test
    fun `given an event of type ANR and config to not capture screenshot, does not add screenshot as attachment`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR
        configProvider.trackScreenshotOnCrash = false

        // When
        signalProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, signalStore.trackedEvents.size)
        val attachments = signalStore.trackedEvents.first().attachments
        assertEquals(0, attachments.size)
    }

    @Test
    fun `given transformer drops event, then does not store event`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        val eventTransformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T>? = null
        }
        val signalProcessor = SignalProcessorImpl(
            logger = NoopLogger(),
            ioExecutor = executorService,
            signalStore = signalStore,
            idProvider = idProvider,
            sessionManager = sessionManager,
            attributeProcessors = emptyList(),
            exceptionExporter = exceptionExporter,
            screenshotCollector = screenshotCollector,
            configProvider = configProvider,
            eventTransformer = eventTransformer,
        )

        // When
        signalProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )
        signalProcessor.track(
            data = "data",
            timestamp = timestamp,
            type = EventType.STRING,
        )

        // Then
        assertEquals(0, signalStore.trackedEvents.size)
    }

    @Test
    fun `given transformer modifies event, then stores modified event`() {
        // Given
        val activityLifecycleData = TestData.getActivityLifecycleData(intent = "intent-data")
        val timestamp = 9856564654L
        val type = EventType.LIFECYCLE_ACTIVITY

        val eventTransformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                // drop the intent data from the event
                (event.data as ActivityLifecycleData).intent = null
                return event
            }
        }
        val signalProcessor = SignalProcessorImpl(
            logger = NoopLogger(),
            ioExecutor = executorService,
            signalStore = signalStore,
            idProvider = idProvider,
            sessionManager = sessionManager,
            attributeProcessors = emptyList(),
            exceptionExporter = exceptionExporter,
            screenshotCollector = screenshotCollector,
            configProvider = configProvider,
            eventTransformer = eventTransformer,
        )

        // When
        signalProcessor.track(
            data = activityLifecycleData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertEquals(1, signalStore.trackedEvents.size)
        // verify intent data is dropped from the event
        assertNull((signalStore.trackedEvents.first().data as ActivityLifecycleData).intent)
    }

    @Test
    fun `given a user triggered event, then stores the event`() {
        val data = TestData.getScreenViewData()
        val timestamp = 1710746412L
        val eventType = EventType.SCREEN_VIEW
        val expectedEvent = data.toEvent(
            type = eventType,
            timestamp = timestamp.iso8601Timestamp(),
            id = idProvider.id,
            sessionId = sessionManager.getSessionId(),
            userTriggered = true,
        ).apply { appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name) }

        signalProcessor.trackUserTriggered(
            data = data,
            timestamp = timestamp,
            type = eventType,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(expectedEvent, signalStore.trackedEvents.first())
    }

    @Test
    fun `calls onEventTracked on session manager when crash is stored`() {
        // Given
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        // When
        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertTrue(sessionManager.onEventTracked)
    }

    @Test
    fun `calls onEventTracked on session manager when event is stored`() {
        // Given
        val data = TestData.getScreenViewData()
        val timestamp = 9856564654L
        val type = EventType.SCREEN_VIEW

        // When
        signalProcessor.track(
            data = data,
            timestamp = timestamp,
            type = type,
        )

        // Then
        assertTrue(sessionManager.onEventTracked)
    }

    @Test
    fun `trackSpan stores span`() {
        // When
        val spanData = TestData.getSpanData()
        signalProcessor.trackSpan(spanData)

        // Then
        assertTrue(signalStore.trackedSpans.contains(spanData))
    }
}
