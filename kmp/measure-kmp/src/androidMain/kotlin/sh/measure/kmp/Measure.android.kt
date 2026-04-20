package sh.measure.kmp

import sh.measure.kmp.attributes.AttributeValue
import sh.measure.kmp.attributes.toAndroid
import sh.measure.kmp.tracing.AndroidSpanWrapper
import sh.measure.kmp.tracing.Span
import sh.measure.kmp.tracing.SpanBuilder
import sh.measure.kmp.tracing.toKmp
import sh.measure.android.Measure as AndroidMeasure
import sh.measure.android.MsrAttachment as AndroidMsrAttachment

actual object Measure {
    actual fun start() = AndroidMeasure.start()

    actual fun stop() = AndroidMeasure.stop()

    actual fun setUserId(userId: String) = AndroidMeasure.setUserId(userId)

    actual fun clearUserId() = AndroidMeasure.clearUserId()

    actual fun trackScreenView(screenName: String, attributes: Map<String, AttributeValue>) {
        AndroidMeasure.trackScreenView(screenName, attributes.toAndroid())
    }

    actual fun trackHandledException(throwable: Throwable, attributes: Map<String, AttributeValue>) {
        AndroidMeasure.trackHandledException(throwable, attributes.toAndroid())
    }

    actual fun trackEvent(
        name: String,
        attributes: Map<String, AttributeValue>,
        timestamp: Long?,
    ) {
        AndroidMeasure.trackEvent(name, attributes.toAndroid(), timestamp)
    }

    actual fun startSpan(name: String): Span = AndroidMeasure.startSpan(name).toKmp()

    actual fun startSpan(name: String, timestamp: Long): Span =
        AndroidMeasure.startSpan(name, timestamp).toKmp()

    actual fun createSpanBuilder(name: String): SpanBuilder? =
        AndroidMeasure.createSpanBuilder(name)?.toKmp()

    actual fun getTraceParentHeaderValue(span: Span): String =
        AndroidMeasure.getTraceParentHeaderValue((span as AndroidSpanWrapper).delegate)

    actual fun getTraceParentHeaderKey(): String = AndroidMeasure.getTraceParentHeaderKey()

    actual fun getCurrentTime(): Long = AndroidMeasure.getCurrentTime()

    actual fun getSessionId(): String? = AndroidMeasure.getSessionId()

    actual fun trackBugReport(
        description: String,
        attachments: List<MsrAttachment>,
        attributes: Map<String, AttributeValue>,
    ) {
        AndroidMeasure.trackBugReport(
            description,
            attachments.map { it.toAndroid() },
            attributes.toAndroid().toMutableMap(),
        )
    }

    actual fun trackHttpEvent(
        url: String,
        method: String,
        startTime: Long,
        endTime: Long,
        statusCode: Int?,
        error: Throwable?,
        requestHeaders: Map<String, String>?,
        responseHeaders: Map<String, String>?,
        requestBody: String?,
        responseBody: String?,
        client: String,
    ) {
        AndroidMeasure.trackHttpEvent(
            url = url,
            method = method,
            startTime = startTime,
            endTime = endTime,
            statusCode = statusCode,
            error = error as? Exception,
            requestHeaders = requestHeaders?.toMutableMap(),
            responseHeaders = responseHeaders?.toMutableMap(),
            requestBody = requestBody,
            responseBody = responseBody,
            client = client,
        )
    }
}

private fun MsrAttachment.toAndroid(): AndroidMsrAttachment =
    AndroidMsrAttachment(name = name, path = path, type = type)
