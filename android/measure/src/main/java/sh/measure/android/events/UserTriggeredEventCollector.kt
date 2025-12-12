package sh.measure.android.events

import sh.measure.android.MsrAttachment
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.BugReportData
import sh.measure.android.config.ConfigProvider
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.toEventAttachment
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal interface UserTriggeredEventCollector {
    fun trackHandledException(throwable: Throwable, attributes: Map<String, AttributeValue>)
    fun trackScreenView(screenName: String, attributes: Map<String, AttributeValue>)
    fun register()
    fun unregister()
    fun trackBugReport(
        description: String,
        screenshots: List<MsrAttachment>,
        attributes: MutableMap<String, AttributeValue>,
    )

    fun trackHttp(
        url: String,
        method: String,
        startTime: Long,
        endTime: Long,
        client: String,
        statusCode: Int?,
        failureReason: String?,
        failureDescription: String?,
        requestHeaders: MutableMap<String, String>?,
        responseHeaders: MutableMap<String, String>?,
        requestBody: String?,
        responseBody: String?,
    )
}

internal class UserTriggeredEventCollectorImpl(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val processInfoProvider: ProcessInfoProvider,
    private val configProvider: ConfigProvider,
) : UserTriggeredEventCollector {
    private var enabled = AtomicBoolean(false)

    override fun register() {
        enabled.compareAndSet(false, true)
    }

    override fun unregister() {
        enabled.compareAndSet(true, false)
    }

    override fun trackBugReport(
        description: String,
        screenshots: List<MsrAttachment>,
        attributes: MutableMap<String, AttributeValue>,
    ) {
        if (!enabled.get()) {
            return
        }
        val timestamp = timeProvider.now()
        val bugReportData = BugReportData(description)
        val attachments =
            screenshots.take(configProvider.maxAttachmentsInBugReport)
                .map { it.toEventAttachment(AttachmentType.SCREENSHOT) }.toMutableList()
        signalProcessor.trackBugReport(
            data = bugReportData,
            type = EventType.BUG_REPORT,
            timestamp = timestamp,
            attachments = attachments,
            userDefinedAttributes = attributes,
            userTriggered = true,
        )
    }

    override fun trackHttp(
        url: String,
        method: String,
        startTime: Long,
        endTime: Long,
        client: String,
        statusCode: Int?,
        failureReason: String?,
        failureDescription: String?,
        requestHeaders: MutableMap<String, String>?,
        responseHeaders: MutableMap<String, String>?,
        requestBody: String?,
        responseBody: String?,
    ) {
        val timestamp = timeProvider.now()
        // validate url to be not empty
        if (url.isEmpty()) {
            logger.log(LogLevel.Error, "Failed to track HTTP event, url is required")
            return
        }

        // validate method
        if (method != "get" && method != "post" && method != "put" && method != "delete" && method != "patch") {
            logger.log(LogLevel.Error, "Failed to track HTTP event, invalid method $method")
            return
        }

        // validate start and end time
        if (startTime <= 0 || endTime <= 0) {
            logger.log(LogLevel.Error, "Failed to track HTTP event, invalid start or end time")
            return
        }
        if (endTime - startTime < 0) {
            logger.log(LogLevel.Error, "Failed to track HTTP event, invalid start or end time")
            return
        }

        // validate status code
        if (statusCode != null && statusCode !in 100..599) {
            logger.log(
                LogLevel.Error,
                "Failed to track HTTP event, invalid status code: $statusCode",
            )
            return
        }

        // apply URL configs
        if (!configProvider.shouldTrackHttpEvent(url)) {
            logger.log(LogLevel.Debug, "Discarding HTTP event, URL is not allowed for tracking")
            return
        }

        requestHeaders?.entries?.removeAll { !configProvider.shouldTrackHttpHeader(it.key) }
        responseHeaders?.entries?.removeAll { !configProvider.shouldTrackHttpHeader(it.key) }

        val shouldTrackRequestHttpBody =
            configProvider.shouldTrackHttpRequestBody(url)
        val shouldTrackResponseHttpBody =
            configProvider.shouldTrackHttpResponseBody(url)

        val data = HttpData(
            url = url,
            method = method,
            status_code = statusCode,
            start_time = startTime,
            end_time = endTime,
            client = client,
            request_headers = requestHeaders,
            response_headers = responseHeaders,
            request_body = if (shouldTrackRequestHttpBody) requestBody else null,
            response_body = if (shouldTrackResponseHttpBody) responseBody else null,
            failure_reason = failureReason,
            failure_description = failureDescription,
        )

        signalProcessor.track(
            data = data,
            timestamp = timestamp,
            type = EventType.HTTP,
            threadName = Thread.currentThread().name,
            userTriggered = true,
        )
    }

    override fun trackHandledException(
        throwable: Throwable,
        attributes: Map<String, AttributeValue>,
    ) {
        if (!enabled.get()) {
            return
        }
        // this is a safe assumption that we're on the same thread as the exception was captured on
        val thread = Thread.currentThread()
        signalProcessor.trackUserTriggered(
            data = ExceptionFactory.createMeasureException(
                throwable = throwable,
                handled = true,
                thread = thread,
                foreground = processInfoProvider.isForegroundProcess(),
            ),
            timestamp = timeProvider.now(),
            type = EventType.EXCEPTION,
            userDefinedAttributes = attributes,
        )
        logger.log(LogLevel.Debug, "Unhandled exception event received")
    }

    override fun trackScreenView(screenName: String, attributes: Map<String, AttributeValue>) {
        if (!enabled.get()) {
            return
        }
        signalProcessor.trackUserTriggered(
            data = ScreenViewData(name = screenName),
            timestamp = timeProvider.now(),
            type = EventType.SCREEN_VIEW,
            userDefinedAttributes = attributes,
        )
        logger.log(LogLevel.Debug, "Screen view event received")
    }
}
