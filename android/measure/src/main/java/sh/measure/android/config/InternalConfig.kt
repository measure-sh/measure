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
     * The threshold after which a session is considered ended. Defaults to 20 minutes.
     */
    val sessionEndLastEventThresholdMs: Long

    /**
     * The maximum duration for a session. Used when the app comes to foreground, sessions which
     * remain in foreground for more than this time will still continue.
     *
     * Defaults to 6 hours.
     */
    val maxSessionDurationMs: Long

    /**
     * The maximum length of a custom event. Defaults to 64 chars.
     */
    val maxEventNameLength: Int

    /**
     * The maximum number of user defined attributes for an event. Defaults to 100.
     */
    val maxUserDefinedAttributesPerEvent: Int

    /**
     * The regex to validate a custom event name.
     */
    val customEventNameRegex: String

    /**
     * The maximum length of user defined attribute key. Defaults to 256 chars.
     */
    val maxUserDefinedAttributeKeyLength: Int

    /**
     * The maximum length of a user defined attribute value. Defaults to 256 chars.
     */
    val maxUserDefinedAttributeValueLength: Int

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

    /**
     * The maximum number of (events + spans) allowed in the database.
     * If the number of events exceeds this limit, the oldest session is deleted everytime
     * cleanup is triggered until the total number of events is below this limit.
     */
    val maxSignalsInDatabase: Int

    /**
     * Max length of a span name. Defaults to 64.
     */
    val maxSpanNameLength: Int

    /**
     * Max length of a checkpoint name. Defaults to 64.
     */
    val maxCheckpointNameLength: Int

    /**
     * Max checkpoints per span. Defaults to 100.
     */
    val maxCheckpointsPerSpan: Int
}
