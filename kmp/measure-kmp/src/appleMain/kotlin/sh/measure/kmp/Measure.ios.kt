package sh.measure.kmp

import cocoapods.measure_sh.clearUserId
import cocoapods.measure_sh.getCurrentTime
import cocoapods.measure_sh.getSessionId
import cocoapods.measure_sh.setUserId
import cocoapods.measure_sh.start
import cocoapods.measure_sh.stop
import cocoapods.measure_sh.trackBugReportWithDescription
import cocoapods.measure_sh.trackEvent
import cocoapods.measure_sh.trackException
import cocoapods.measure_sh.trackScreenView
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSNumber
import platform.Foundation.numberWithLongLong
import sh.measure.kmp.attributes.AttributeValue
import sh.measure.kmp.attributes.toNative
import sh.measure.kmp.nsexception.asNSException
import sh.measure.kmp.tracing.Span
import sh.measure.kmp.tracing.SpanBuilder
import cocoapods.measure_sh.Measure as IosMeasure

// Span, createSpanBuilder, traceparent helpers, and trackHttpEvent are not yet reachable
// through cinterop: the underlying Swift APIs in MeasureSDK/Swift/Measure.swift lack @objc
// annotations, so the generated Kotlin bindings do not include them. Exposing them to KMP
// consumers requires either adding @objc overloads on the Swift side or introducing an
// Objective-C-friendly bridge. Tracked as a follow-up.
private const val UNSUPPORTED_SPAN =
    "Spans are not yet available in the iOS KMP bindings. The underlying Swift API lacks " +
        "@objc annotations; follow-up work will expose it to Kotlin/Native cinterop."
private const val UNSUPPORTED_HTTP =
    "trackHttpEvent is not yet available in the iOS KMP bindings. The underlying Swift API " +
        "lacks an @objc overload; follow-up work will expose it to Kotlin/Native cinterop."

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

    actual fun startSpan(name: String): Span = throw NotImplementedError(UNSUPPORTED_SPAN)

    actual fun startSpan(name: String, timestamp: Long): Span =
        throw NotImplementedError(UNSUPPORTED_SPAN)

    actual fun createSpanBuilder(name: String): SpanBuilder? =
        throw NotImplementedError(UNSUPPORTED_SPAN)

    actual fun getTraceParentHeaderValue(span: Span): String =
        throw NotImplementedError(UNSUPPORTED_SPAN)

    actual fun getTraceParentHeaderKey(): String = throw NotImplementedError(UNSUPPORTED_SPAN)

    actual fun getCurrentTime(): Long = IosMeasure.getCurrentTime()

    actual fun getSessionId(): String? = IosMeasure.getSessionId()

    actual fun trackBugReport(
        description: String,
        attachments: List<MsrAttachment>,
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
        error: Throwable?,
        requestHeaders: Map<String, String>?,
        responseHeaders: Map<String, String>?,
        requestBody: String?,
        responseBody: String?,
        client: String,
    ): Unit = throw NotImplementedError(UNSUPPORTED_HTTP)
}
