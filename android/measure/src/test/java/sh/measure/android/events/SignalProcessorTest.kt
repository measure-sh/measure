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
import sh.measure.android.exporter.ExceptionExporter
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSessionManager
import sh.measure.android.fakes.FakeSignalStore
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
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
        ).apply {
            appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name)
            appendAttribute(Attribute.PLATFORM_KEY, "android")
        }

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
        ).apply {
            appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name)
            appendAttribute(Attribute.PLATFORM_KEY, "android")
        }

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
        ).apply {
            appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name)
            appendAttribute(Attribute.PLATFORM_KEY, "android")
        }

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
    fun `given an event of type app exit, applies attributes and updates version info`() {
        // Given
        val appExit = TestData.getAppExit()
        val timestamp = 1710746412L
        val type = EventType.APP_EXIT
        val sessionId = "session-id-app-exit"
        val appVersion = "app-version"
        val appBuild = "1000"

        // When
        signalProcessor.trackAppExit(
            data = appExit,
            timestamp = timestamp,
            type = type,
            sessionId = sessionId,
            appVersion = appVersion,
            appBuild = appBuild,
            threadName = "thread-name",
        )

        // Then
        assertEquals(1, signalStore.trackedEvents.size)
        val event = signalStore.trackedEvents.first()
        assertEquals(type, event.type)
        assertEquals(appBuild, event.attributes[Attribute.APP_BUILD_KEY])
        assertEquals(appVersion, event.attributes[Attribute.APP_VERSION_KEY])
        assertEquals(sessionId, event.sessionId)
    }

    @Test
    fun `given an event of type bug_report, marks session with bug report`() {
        // Given
        val bugReportData = TestData.getBugReportData()
        val timestamp = 1710746412L
        val type = EventType.BUG_REPORT
        val sessionId = "session-id-bug-report"

        // When
        signalProcessor.track(
            data = bugReportData,
            timestamp = timestamp,
            type = type,
            sessionId = sessionId,
        )

        // Then
        assertTrue(sessionManager.markedSessionWithBugReport)
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
        ).apply {
            appendAttribute(Attribute.THREAD_NAME, Thread.currentThread().name)
            appendAttribute(Attribute.PLATFORM_KEY, "android")
        }

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
