package sh.measure.kmp

import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSNumber
import platform.Foundation.numberWithInt
import platform.Foundation.numberWithLongLong
import sh.measure.ios.bindings.BugReportConfig
import sh.measure.ios.bindings.clearUserId
import sh.measure.ios.bindings.createSpanBuilderWithName
import sh.measure.ios.bindings.getCurrentTime
import sh.measure.ios.bindings.getSessionId
import sh.measure.ios.bindings.getTraceParentHeaderKey
import sh.measure.ios.bindings.getTraceParentHeaderValueForSpan
import sh.measure.ios.bindings.launchBugReportWithTakeScreenshot
import sh.measure.ios.bindings.setUserId
import sh.measure.ios.bindings.start
import sh.measure.ios.bindings.startSpanWithName
import sh.measure.ios.bindings.stop
import sh.measure.ios.bindings.trackBugReportWithDescription
import sh.measure.ios.bindings.trackEvent
import sh.measure.ios.bindings.trackException
import sh.measure.ios.bindings.trackHttpEventObjcWithUrl
import sh.measure.ios.bindings.trackScreenView
import sh.measure.kmp.attributes.AttributeValue
import sh.measure.kmp.attributes.toNative
import sh.measure.kmp.nsexception.asNSError
import sh.measure.kmp.nsexception.asNSException
import sh.measure.kmp.tracing.IosSpanBuilder
import sh.measure.kmp.tracing.IosSpan
import sh.measure.kmp.tracing.Span
import sh.measure.kmp.tracing.SpanBuilder
import sh.measure.kmp.tracing.unwrap
import sh.measure.ios.bindings.Measure as IosMeasure

// cinterop exposes ObjC `NSDictionary<NSString*, NSString*>?` as `Map<Any?, *>?`; since K is
// invariant in Kotlin's `Map`, a `Map<String, String>` isn't assignable. Cast each entry to the
// wider type so the call site type-checks.
private fun Map<String, String>.toBindingsStringMap(): Map<Any?, Any> =
    entries.associate { (k, v) -> k to v }

@OptIn(ExperimentalForeignApi::class)
actual object Measure {
    actual fun start() = IosMeasure.start()

    actual fun stop() = IosMeasure.stop()

    actual fun setUserId(userId: String) = IosMeasure.setUserId(userId)

    actual fun clearUserId() = IosMeasure.clearUserId()

    actual fun trackScreenView(screenName: String, attributes: Map<String, AttributeValue>) {
        IosMeasure.trackScreenView(screenName, attributes.toNative())
    }

    actual fun trackHandledException(
        throwable: Throwable,
        attributes: Map<String, AttributeValue>,
    ) {
        IosMeasure.trackException(
            throwable.asNSException(appendCausedBy = true),
            attributes.toNative(),
            collectStackTraces = false,
        )
    }

    actual fun trackEvent(
        name: String,
        attributes: Map<String, AttributeValue>,
        timestamp: Long?,
    ) {
        IosMeasure.trackEvent(
            name,
            attributes.toNative(),
            timestamp?.let { NSNumber.numberWithLongLong(it) },
        )
    }

    actual fun startSpan(name: String): Span = IosSpan(IosMeasure.startSpanWithName(name))

    actual fun startSpan(name: String, timestamp: Long): Span =
        IosSpan(IosMeasure.startSpanWithName(name, timestamp = timestamp))

    actual fun createSpanBuilder(name: String): SpanBuilder? =
        IosMeasure.createSpanBuilderWithName(name)?.let(::IosSpanBuilder)

    actual fun getTraceParentHeaderValue(span: Span): String =
        IosMeasure.getTraceParentHeaderValueForSpan(span.unwrap())

    actual fun getTraceParentHeaderKey(): String = IosMeasure.getTraceParentHeaderKey()

    actual fun getCurrentTime(): Long = IosMeasure.getCurrentTime()

    actual fun getSessionId(): String? = IosMeasure.getSessionId()

    actual fun launchBugReport(
        takeScreenshot: Boolean,
        attributes: Map<String, AttributeValue>,
    ) {
        IosMeasure.launchBugReportWithTakeScreenshot(
            takeScreenshot = takeScreenshot,
            bugReportConfig = BugReportConfig.defaultConfig(),
            attributes = attributes.toNative(),
        )
    }

    actual fun trackBugReport(
        description: String,
        attachments: List<Attachment>,
        attributes: Map<String, AttributeValue>,
    ) {
        // iOS MsrAttachment cannot be constructed from KMP (its initializer is not
        // ObjC-compatible), so KMP-supplied attachments are dropped on iOS. Users needing
        // attachments should use the iOS-specific capture APIs exposed in MeasureIos.kt.
        IosMeasure.trackBugReportWithDescription(
            description,
            emptyList<Any>(),
            attributes.toNative(),
        )
    }

    actual fun trackHttpEvent(
        url: String,
        method: String,
        startTime: Long,
        endTime: Long,
        statusCode: Int?,
        error: Exception?,
        requestHeaders: Map<String, String>?,
        responseHeaders: Map<String, String>?,
        requestBody: String?,
        responseBody: String?,
        client: String,
    ) {
        IosMeasure.trackHttpEventObjcWithUrl(
            url = url,
            method = method,
            startTime = startTime.toULong(),
            endTime = endTime.toULong(),
            client = client,
            statusCode = statusCode?.let { NSNumber.numberWithInt(it) },
            error = error?.asNSError(),
            requestHeaders = requestHeaders?.toBindingsStringMap(),
            responseHeaders = responseHeaders?.toBindingsStringMap(),
            requestBody = requestBody,
            responseBody = responseBody,
        )
    }
}
