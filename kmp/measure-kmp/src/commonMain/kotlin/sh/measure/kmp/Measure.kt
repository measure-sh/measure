package sh.measure.kmp

import sh.measure.kmp.attributes.AttributeValue
import sh.measure.kmp.tracing.Span
import sh.measure.kmp.tracing.SpanBuilder

/**
 * Measure SDK entry point usable from Kotlin Multiplatform common code.
 *
 * Platform-specific initialization (Android `Context`, iOS `ClientInfo`) lives in the
 * respective platform source sets. After initializing on each platform, everything in this
 * object works from shared code.
 */
expect object Measure {
    /**
     * Starts tracking. This is a no-op if the SDK was not initialized or is already tracking.
     */
    fun start()

    /**
     * Stops tracking. This is a no-op if the SDK was not initialized or is already stopped.
     */
    fun stop()

    /**
     * Sets the user ID for the current user.
     */
    fun setUserId(userId: String)

    /**
     * Clears the previously set user ID.
     */
    fun clearUserId()

    /**
     * Tracks a screen view.
     */
    fun trackScreenView(screenName: String, attributes: Map<String, AttributeValue> = emptyMap())

    /**
     * Tracks a handled exception.
     */
    fun trackHandledException(throwable: Throwable, attributes: Map<String, AttributeValue> = emptyMap())

    /**
     * Tracks a custom event.
     */
    fun trackEvent(
        name: String,
        attributes: Map<String, AttributeValue> = emptyMap(),
        timestamp: Long? = null,
    )

    /**
     * Starts a new performance tracing span with the specified name.
     */
    fun startSpan(name: String): Span

    /**
     * Starts a new performance tracing span with the specified name and start timestamp.
     */
    fun startSpan(name: String, timestamp: Long): Span

    /**
     * Creates a configurable span builder for deferred span creation.
     */
    fun createSpanBuilder(name: String): SpanBuilder?

    /**
     * Returns the W3C traceparent header value for the given span.
     */
    fun getTraceParentHeaderValue(span: Span): String

    /**
     * Returns the W3C traceparent header key/name.
     */
    fun getTraceParentHeaderKey(): String

    /**
     * Returns the current time in milliseconds since epoch using a monotonic clock source.
     */
    fun getCurrentTime(): Long

    /**
     * Returns the session ID for the current session, or null if the SDK has not been initialized.
     */
    fun getSessionId(): String?

    /**
     * Tracks a custom bug report.
     */
    fun trackBugReport(
        description: String,
        attachments: List<MsrAttachment> = listOf(),
        attributes: Map<String, AttributeValue> = emptyMap(),
    )

    /**
     * Tracks an HTTP event.
     */
    fun trackHttpEvent(
        url: String,
        method: String,
        startTime: Long,
        endTime: Long,
        statusCode: Int? = null,
        error: Throwable? = null,
        requestHeaders: Map<String, String>? = null,
        responseHeaders: Map<String, String>? = null,
        requestBody: String? = null,
        responseBody: String? = null,
        client: String = "unknown",
    )
}
