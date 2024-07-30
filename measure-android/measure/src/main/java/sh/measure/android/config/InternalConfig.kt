package sh.measure.android.config

import sh.measure.android.events.EventType

internal interface InternalConfig {
    /**
     * The maximum size of attachments allowed in a single batch. Defaults to 3MB
     */
    val maxAttachmentSizeInEventsBatchInBytes: Int

    /**
     * The interval at which to create a batch for export.
     */
    val eventsBatchingIntervalMs: Long

    /**
     * The maximum number of events to export in /events API. Defaults to 500.
     */
    val maxEventsInBatch: Int

    /**
     * When `httpBodyCapture` is enabled, this determines whether to capture the body or not based
     * on the content type of the request/response. Defaults to `application/json`.
     */
    val httpContentTypeAllowlist: List<String>

    /**
     * Default list of HTTP headers to not capture for network request and response.
     */
    val defaultHttpHeadersBlocklist: List<String>

    /**
     * The TTL sessions after which the data will be cleared. Defaults to 15 days.
     */
    val sessionsTtlMs: Long

    /**
     * The TTL of unsampled sessions. Defaults to 3 days.
     */
    val unsampledSessionTtlMs: Long

    /**
     * The threshold after which a session is considered ended. Defaults to 1 minute.
     */
    val sessionEndThresholdMs: Long

    /**
     * The maximum length of user defined attribute key. Defaults to 64 chars.
     */
    val maxUserDefinedAttributeKeyLength: Int

    /**
     * The maximum length of a user defined attribute value. Defaults to 256 chars.
     */
    val maxUserDefinedAttributeValueLength: Int

    /**
     * Whether user defined attribute keys can have spaces or not. Defaults to `false`.
     */
    val userDefinedAttributeKeyWithSpaces: Boolean

    /**
     * The color of the mask to apply to the screenshot. The value should be a hex color string.
     * For example, "#222222".
     */
    val screenshotMaskHexColor: String

    /**
     * The compression quality of the screenshot. Must be between 0 and 100, where 0 is lowest quality
     * and smallest size while 100 is highest quality and largest size.
     */
    val screenshotCompressionQuality: Int

    /**
     * All [EventType]'s that are always exported, regardless of other filters like session
     * sampling rate and whether the session crashed or not.
     */
    val eventTypeExportAllowList: List<String>
}
