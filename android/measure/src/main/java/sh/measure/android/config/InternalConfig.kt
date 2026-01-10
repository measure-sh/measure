package sh.measure.android.config

import sh.measure.android.events.EventType

internal interface InternalConfig {
    /**
     * The interval between consecutive requests for batch export.
     */
    val batchExportIntervalMs: Long

    /**
     * The interval between consecutive requests for attachment export.
     */
    val attachmentExportIntervalMs: Long

    /**
     * Default list of HTTP headers to not capture for network request and response.
     */
    val defaultHttpHeadersBlocklist: List<String>

    /**
     * Starts a new session when app comes back to foreground after this threshold.
     * Defaults to 30 seconds.
     */
    val sessionBackgroundTimeoutThresholdMs: Long

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
    val eventTypeExportAllowList: List<EventType>

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

    /**
     * Maximum number of signals (events and spans) in the in memory queue. Defaults to 30.
     */
    val maxInMemorySignalsQueueSize: Int

    /**
     * The timeout after which signals are attempted to be flushed to disk in milliseconds.
     * Defaults to 3000ms.
     */
    val inMemorySignalsQueueFlushRateMs: Long

    /**
     * The maximum allowed attachments in a bug report. Defaults to 5.
     */
    val maxAttachmentsInBugReport: Int

    /**
     * The maximum allowed characters in a bug report. Defaults to 1000.
     */
    val maxDescriptionLengthInBugReport: Int

    /**
     * The force threshold to trigger a shake (higher = less sensitive).
     * Defaults to 2.5 * GRAVITY_EARTH ≈ 24.5 m/s².
     */
    val shakeAccelerationThreshold: Float

    /**
     *  Minimum time between shake detections in milliseconds. Defaults to 5000 ms.
     */
    val shakeMinTimeIntervalMs: Long

    /**
     * Number of movements required before considering a shake. Defaults to 2.
     */
    val shakeSlop: Int

    /**
     * List of custom headers that should not be included.
     */
    val disallowedCustomHeaders: List<String>

    /**
     * The estimated size of one event on disk.
     */
    val estimatedEventSizeInKb: Int
}
