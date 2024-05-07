package sh.measure.android

private val disabledHttpBodyUrlPatterns = listOf(
    // measure sessions endpoint for local development
    // TODO(abhay): always ignore all measure endpoints
    "10.0.2.2:8080/events",
)

private val enabledHttpBodyContentTypePatterns = listOf(
    "application/json",
)

/**
 * Configures behavior of the Measure SDK.
 */
internal interface Config {
    /**
     * Whether screenshot should be automatically captured for exceptions and ANRs.
     */
    val captureScreenshotForExceptions: Boolean

    /**
     * The timeout in milliseconds after which an ANR is detected.
     */
    val anrTimeoutMs: Long

    /**
     * The maximum size of an attachment in bytes that can be added to one batch of events to
     * be exported.
     */
    val maxAttachmentSizeInBytes: Int

    /**
     * The maximum number of events that can be added to one batch of events to be exported.
     */
    val maxEventsBatchSize: Int

    /**
     * The interval in milliseconds at which the events are exported.
     */
    val batchingIntervalMs: Long

    /**
     * Returns `true` if the HTTP body should be tracked for the given URL and content type.
     */
    fun trackHttpBody(url: String, contentType: String?): Boolean
}

internal class DefaultConfig : Config {
    override val captureScreenshotForExceptions: Boolean = false

    override val anrTimeoutMs: Long = 5_000 // 5 seconds

    override val maxAttachmentSizeInBytes: Int = 3 * 1024 * 1024 // 3 MB

    override val maxEventsBatchSize: Int = 50 // 50 events

    override val batchingIntervalMs: Long = 10_000 // 10 seconds

    override fun trackHttpBody(url: String, contentType: String?): Boolean {
        if (contentType.isNullOrEmpty()) {
            return false
        }
        if (disabledHttpBodyUrlPatterns.any { url.contains(it) }) {
            return false
        }
        return enabledHttpBodyContentTypePatterns.any { contentType.startsWith(it) }
    }
}
