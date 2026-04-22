package sh.measure.android.events

import androidx.concurrent.futures.ResolvableFuture
import junit.framework.TestCase.assertEquals
import junit.framework.TestCase.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.verify
import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.StringAttr
import sh.measure.android.exporter.Exporter
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.FakeSampler
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
    private val exporter = mock<Exporter>()
    private val screenshotCollector = mock<ScreenshotCollector>()
    private val configProvider = FakeConfigProvider()
    private val sampler = FakeSampler()

    private val signalProcessor = SignalProcessorImpl(
        logger = NoopLogger(),
        ioExecutor = executorService,
        signalStore = signalStore,
        idProvider = idProvider,
        sessionManager = sessionManager,
        attributeProcessors = emptyList(),
        exporter = exporter,
        screenshotCollector = screenshotCollector,
        configProvider = configProvider,
        sampler = sampler,
    )

    @Before
    fun setUp() {
        configProvider.enableFullCollectionMode = false
        configProvider.crashTakeScreenshot = false
        configProvider.anrTakeScreenshot = false
    }

    @Test
    fun `track stores event with session id, event id, thread name and platform attributes`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION

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
    fun `track stores event with attachments`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val attachments = mutableListOf(TestData.getAttachment())

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
    fun `track stores event with provided attributes`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val attributes: MutableMap<String, Any?> = mutableMapOf("key" to "value")

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
    fun `track uses provided sessionId instead of session manager`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 1710746412L
        val type = EventType.EXCEPTION
        val customSessionId = "custom-session-id"

        signalProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            sessionId = customSessionId,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(customSessionId, signalStore.trackedEvents.first().sessionId)
    }

    @Test
    fun `track applies attribute processors to event`() {
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
            exporter = exporter,
            screenshotCollector = screenshotCollector,
            configProvider = configProvider,
            sampler = sampler,
        )

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
    fun `track drops event when user defined attributes exceed maximum count`() {
        val attributes = (0..configProvider.maxUserDefinedAttributesPerEvent).associate {
            "key$it" to StringAttr("value")
        }
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        signalProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            userDefinedAttributes = attributes,
        )

        assertEquals(0, signalStore.trackedEvents.size)
    }

    @Test
    fun `track drops event when user defined attribute key exceeds maximum length`() {
        val longKey = "k".repeat(configProvider.maxUserDefinedAttributeKeyLength + 1)
        val attributes = mapOf(longKey to StringAttr("value"))
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        signalProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            userDefinedAttributes = attributes,
        )

        assertEquals(0, signalStore.trackedEvents.size)
    }

    @Test
    fun `track drops event when user defined attribute value exceeds maximum length`() {
        val invalidAttributeValue =
            "v".repeat(configProvider.maxUserDefinedAttributeValueLength + 1)
        val attributes = mapOf("key" to StringAttr(invalidAttributeValue))
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        signalProcessor.track(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            userDefinedAttributes = attributes,
        )

        assertEquals(0, signalStore.trackedEvents.size)
    }

    @Test
    fun `trackUserTriggered stores event with userTriggered flag`() {
        val data = TestData.getScreenViewData()
        val timestamp = 1710746412L
        val eventType = EventType.SCREEN_VIEW
        val expectedEvent = data.toEvent(
            type = eventType,
            timestamp = timestamp.iso8601Timestamp(),
            id = idProvider.id,
            sessionId = sessionManager.getSessionId(),
            userTriggered = true,
            isSampled = sampler.trackJourneyForSession,
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
    fun `trackCrash for exception stores event and triggers export`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION

        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            takeScreenshot = false,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        verify(exporter).export()
    }

    @Test
    fun `trackCrash for ANR stores event and triggers export`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR

        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            takeScreenshot = false,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        verify(exporter).export()
    }

    @Test
    fun `trackCrash for exception with screenshot enabled adds screenshot attachment`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        configProvider.crashTakeScreenshot = true
        val screenshot = Screenshot(data = byteArrayOf(1, 2, 3, 4), extension = "png")
        `when`(screenshotCollector.takeScreenshot()).thenReturn(screenshot)

        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        val attachments = signalStore.trackedEvents.first().attachments
        assertEquals(1, attachments.size)
        assertEquals("screenshot.png", attachments.first().name)
        assertTrue(screenshot.data.contentEquals(attachments.first().bytes))
    }

    @Test
    fun `trackCrash for exception with screenshot disabled does not add screenshot attachment`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        configProvider.crashTakeScreenshot = false

        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(0, signalStore.trackedEvents.first().attachments.size)
    }

    @Test
    fun `trackCrash for ANR with screenshot enabled adds screenshot attachment`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR
        configProvider.anrTakeScreenshot = true
        val screenshot = Screenshot(data = byteArrayOf(1, 2, 3, 4), extension = "png")
        `when`(screenshotCollector.takeScreenshot()).thenReturn(screenshot)

        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        val attachments = signalStore.trackedEvents.first().attachments
        assertEquals(1, attachments.size)
        assertEquals("screenshot.png", attachments.first().name)
        assertTrue(screenshot.data.contentEquals(attachments.first().bytes))
    }

    @Test
    fun `trackCrash for ANR with screenshot disabled does not add screenshot attachment`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.ANR
        configProvider.anrTakeScreenshot = false

        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(0, signalStore.trackedEvents.first().attachments.size)
    }

    @Test
    fun `trackCrash with takeScreenshot false does not capture screenshot regardless of config`() {
        val exceptionData = TestData.getExceptionData()
        val timestamp = 9856564654L
        val type = EventType.EXCEPTION
        configProvider.crashTakeScreenshot = true

        signalProcessor.trackCrash(
            data = exceptionData,
            timestamp = timestamp,
            type = type,
            takeScreenshot = false,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        assertEquals(0, signalStore.trackedEvents.first().attachments.size)
    }

    @Test
    fun `trackAppExit stores event with provided sessionId and version attributes`() {
        val appExit = TestData.getAppExit()
        val timestamp = 1710746412L
        val type = EventType.APP_EXIT
        val sessionId = "session-id-app-exit"
        val appVersion = "app-version"
        val appBuild = "1000"
        val isSampled = true

        signalProcessor.trackAppExit(
            data = appExit,
            timestamp = timestamp,
            type = type,
            sessionId = sessionId,
            appVersion = appVersion,
            appBuild = appBuild,
            threadName = "thread-name",
            isSampled = isSampled,
        )

        assertEquals(1, signalStore.trackedEvents.size)
        val event = signalStore.trackedEvents.first()
        assertEquals(type, event.type)
        assertEquals(sessionId, event.sessionId)
        assertEquals(appVersion, event.attributes[Attribute.APP_VERSION_KEY])
        assertEquals(appBuild, event.attributes[Attribute.APP_BUILD_KEY])
    }

    @Test
    fun `trackSpan stores span`() {
        val spanData = TestData.getSpanData()

        signalProcessor.trackSpan(spanData)

        assertTrue(signalStore.trackedSpans.contains(spanData))
    }
}
