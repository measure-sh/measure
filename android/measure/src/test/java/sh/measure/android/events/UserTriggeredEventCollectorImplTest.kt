package sh.measure.android.events

import org.junit.Assert
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import sh.measure.android.attributes.StringAttr
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.fakes.TestData
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TestClock

class UserTriggeredEventCollectorImplTest {
    private val logger = NoopLogger()
    private val signalProcessor: SignalProcessor = mock()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private val processInfoProvider: ProcessInfoProvider = FakeProcessInfoProvider()
    private val configProvider = FakeConfigProvider()

    private val userTriggeredEventCollector = UserTriggeredEventCollectorImpl(
        logger,
        signalProcessor,
        timeProvider,
        processInfoProvider,
        configProvider,
    )

    @Test
    fun `tracks screen view event`() {
        val screenName = "screen-name"
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackScreenView(screenName, emptyMap())
        verify(signalProcessor).trackUserTriggered(
            data = ScreenViewData(name = screenName),
            type = EventType.SCREEN_VIEW,
            timestamp = timeProvider.now(),
        )
    }

    @Test
    fun `tracks screen view event with user-defined attributes`() {
        val screenName = "screen-name"
        val attributes = mapOf("key" to StringAttr("value"))
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackScreenView(screenName, attributes)
        verify(signalProcessor).trackUserTriggered(
            data = ScreenViewData(name = screenName),
            type = EventType.SCREEN_VIEW,
            timestamp = timeProvider.now(),
            userDefinedAttributes = attributes,
        )
    }

    @Test
    fun `tracks handled exception event`() {
        val exception = Exception()

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHandledException(exception, emptyMap())
        verify(signalProcessor).trackUserTriggered(
            data = any<ExceptionData>(),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.EXCEPTION),
            attachments = eq(mutableListOf()),
            userDefinedAttributes = eq(mapOf()),
        )
    }

    @Test
    fun `tracks handled exception event with attributes`() {
        val exception = Exception()

        userTriggeredEventCollector.register()
        val attributes = mapOf("key" to StringAttr("value"))
        userTriggeredEventCollector.trackHandledException(exception, attributes)
        verify(signalProcessor).trackUserTriggered(
            data = any<ExceptionData>(),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.EXCEPTION),
            attachments = eq(mutableListOf()),
            userDefinedAttributes = eq(attributes),
        )
    }

    @Test
    fun `tracks bug report event with attachments`() {
        val data = TestData.getBugReportData()
        val screenshot = TestData.getMsrAttachment()
        val attachmentsCaptor = argumentCaptor<MutableList<Attachment>>()

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackBugReport(
            data.description,
            screenshots = listOf(screenshot),
            attributes = mutableMapOf(),
        )
        verify(signalProcessor).trackUserTriggered(
            data = eq(data),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.BUG_REPORT),
            attachments = attachmentsCaptor.capture(),
            userDefinedAttributes = any(),
        )
        Assert.assertEquals(1, attachmentsCaptor.firstValue.size)
    }

    @Test
    fun `tracks bug report event with no attachments`() {
        val data = TestData.getBugReportData()

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackBugReport(
            data.description,
            screenshots = listOf(),
            attributes = mutableMapOf(),
        )
        verify(signalProcessor).trackUserTriggered(
            data = data,
            timestamp = timeProvider.now(),
            type = EventType.BUG_REPORT,
            attachments = mutableListOf(),
        )
    }

    @Test
    fun `disables collection on unregistered`() {
        val exception = Exception()
        userTriggeredEventCollector.unregister()
        userTriggeredEventCollector.trackHandledException(exception, emptyMap())
        verify(signalProcessor, never()).trackUserTriggered(
            any<ExceptionData>(),
            any(),
            any(),
            any(),
            any(),
        )
    }

    @Test
    fun `tracks http event with valid data`() {
        val url = "https://api.example.com/users"
        val method = "get"
        val startTime = 1000L
        val endTime = 2000L
        val client = "okhttp"
        val statusCode = 200

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHttp(
            url = url,
            method = method,
            startTime = startTime,
            endTime = endTime,
            client = client,
            statusCode = statusCode,
            failureReason = null,
            failureDescription = null,
            requestHeaders = null,
            responseHeaders = null,
            requestBody = null,
            responseBody = null,
        )

        verify(signalProcessor).track(
            data = any<HttpData>(),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.HTTP),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = anyOrNull(),
            sessionId = anyOrNull(),
            userTriggered = eq(true),
        )
    }

    @Test
    fun `tracks http event with all optional fields`() {
        val url = "https://api.example.com/users"
        val method = "post"
        val startTime = 1000L
        val endTime = 2000L
        val client = "okhttp"
        val statusCode = 201
        val requestHeaders = mutableMapOf("Content-Type" to "application/json")
        val responseHeaders = mutableMapOf("X-Request-Id" to "123")
        val requestBody = "{\"name\":\"test\"}"
        val responseBody = "{\"id\":1}"

        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHttp(
            url = url,
            method = method,
            startTime = startTime,
            endTime = endTime,
            client = client,
            statusCode = statusCode,
            failureReason = null,
            failureDescription = null,
            requestHeaders = requestHeaders,
            responseHeaders = responseHeaders,
            requestBody = requestBody,
            responseBody = responseBody,
        )

        verify(signalProcessor).track(
            data = any<HttpData>(),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.HTTP),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = anyOrNull(),
            sessionId = anyOrNull(),
            userTriggered = eq(true),
        )
    }

    @Test
    fun `does not track http event when url is empty`() {
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHttp(
            url = "",
            method = "get",
            startTime = 1000L,
            endTime = 2000L,
            client = "okhttp",
            statusCode = 200,
            failureReason = null,
            failureDescription = null,
            requestHeaders = null,
            responseHeaders = null,
            requestBody = null,
            responseBody = null,
        )

        verify(signalProcessor, never()).track(
            any<HttpData>(),
            any(),
            any(),
            any(),
            any(),
            any(),
            anyOrNull(),
            anyOrNull(),
            any(),
        )
    }

    @Test
    fun `does not track http event with invalid method`() {
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHttp(
            url = "https://api.example.com/users",
            method = "invalid",
            startTime = 1000L,
            endTime = 2000L,
            client = "okhttp",
            statusCode = 200,
            failureReason = null,
            failureDescription = null,
            requestHeaders = null,
            responseHeaders = null,
            requestBody = null,
            responseBody = null,
        )

        verify(signalProcessor, never()).track(
            any<HttpData>(),
            any(),
            any(),
            any(),
            any(),
            any(),
            anyOrNull(),
            anyOrNull(),
            any(),
        )
    }

    @Test
    fun `does not track http event when start time is zero or negative`() {
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHttp(
            url = "https://api.example.com/users",
            method = "get",
            startTime = 0L,
            endTime = 2000L,
            client = "okhttp",
            statusCode = 200,
            failureReason = null,
            failureDescription = null,
            requestHeaders = null,
            responseHeaders = null,
            requestBody = null,
            responseBody = null,
        )

        verify(signalProcessor, never()).track(
            any<HttpData>(),
            any(),
            any(),
            any(),
            any(),
            any(),
            anyOrNull(),
            anyOrNull(),
            any(),
        )
    }

    @Test
    fun `does not track http event when end time is less than start time`() {
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHttp(
            url = "https://api.example.com/users",
            method = "get",
            startTime = 2000L,
            endTime = 1000L,
            client = "okhttp",
            statusCode = 200,
            failureReason = null,
            failureDescription = null,
            requestHeaders = null,
            responseHeaders = null,
            requestBody = null,
            responseBody = null,
        )

        verify(signalProcessor, never()).track(
            any<HttpData>(),
            any(),
            any(),
            any(),
            any(),
            any(),
            anyOrNull(),
            anyOrNull(),
            any(),
        )
    }

    @Test
    fun `does not track http event with invalid status code`() {
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHttp(
            url = "https://api.example.com/users",
            method = "get",
            startTime = 1000L,
            endTime = 2000L,
            client = "okhttp",
            statusCode = 999,
            failureReason = null,
            failureDescription = null,
            requestHeaders = null,
            responseHeaders = null,
            requestBody = null,
            responseBody = null,
        )

        verify(signalProcessor, never()).track(
            any<HttpData>(),
            any(),
            any(),
            any(),
            any(),
            any(),
            anyOrNull(),
            anyOrNull(),
            any(),
        )
    }

    @Test
    fun `tracks http event with null status code`() {
        userTriggeredEventCollector.register()
        userTriggeredEventCollector.trackHttp(
            url = "https://api.example.com/users",
            method = "get",
            startTime = 1000L,
            endTime = 2000L,
            client = "okhttp",
            statusCode = null,
            failureReason = "timeout",
            failureDescription = "Connection timeout",
            requestHeaders = null,
            responseHeaders = null,
            requestBody = null,
            responseBody = null,
        )

        verify(signalProcessor).track(
            data = any<HttpData>(),
            timestamp = eq(timeProvider.now()),
            type = eq(EventType.HTTP),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = anyOrNull(),
            sessionId = anyOrNull(),
            userTriggered = eq(true),
        )
    }

    @Test
    fun `tracks http event with all valid http methods`() {
        val methods = listOf("get", "post", "put", "delete", "patch")
        userTriggeredEventCollector.register()

        methods.forEach { method ->
            userTriggeredEventCollector.trackHttp(
                url = "https://api.example.com/users",
                method = method,
                startTime = 1000L,
                endTime = 2000L,
                client = "okhttp",
                statusCode = 200,
                failureReason = null,
                failureDescription = null,
                requestHeaders = null,
                responseHeaders = null,
                requestBody = null,
                responseBody = null,
            )
        }

        verify(signalProcessor, org.mockito.Mockito.times(methods.size)).track(
            data = any<HttpData>(),
            timestamp = any(),
            type = eq(EventType.HTTP),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = anyOrNull(),
            sessionId = anyOrNull(),
            userTriggered = any(),
        )
    }
}
