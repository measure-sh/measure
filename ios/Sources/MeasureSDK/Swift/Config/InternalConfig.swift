//
//  InternalConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Internal configuration options for the Measure SDK.
protocol InternalConfig {
    /// The interval at which to create a batch for export.
    var eventsBatchingIntervalMs: Number { get }

    /// The threshold after which a session is considered ended. Defaults to 20 minute.
    var sessionEndLastEventThresholdMs: Number { get }

    /// The threshold to determine long press. Defaults to 500 ms.
    var longPressTimeout: TimeInterval { get }

    /// The minimum movement before a touch is detected as a scroll. Defaults to 20 points.
    var scaledTouchSlop: CGFloat { get }

    /// The maximum size of attachments allowed in a single batch. Defaults to 3MB
    var maxAttachmentSizeInEventsBatchInBytes: Number { get }

    /// The maximum number of events to export in /events API. Defaults to 500.
    var maxEventsInBatch: Number { get }

    /// The request timeout interval for all tasks within sessions based on this configuration
    var timeoutIntervalForRequest: TimeInterval { get }

    /// The maximum duration for a session. Used when the app comes to foreground, sessions which remain in foreground for more than this time will still continue. Defaults to 6 hours.
    var maxSessionDurationMs: Number { get }

    /// The interval at which CPU related data is collected. Defaults to 3 seconds.
    var cpuTrackingIntervalMs: UnsignedNumber { get }

    /// The interval at which memory related data is collected. Defaults to 2 seconds.
    var memoryTrackingIntervalMs: UnsignedNumber { get }

    /// This determines whether to capture the body or not based on the content type of the request/response. Defaults to `application/json`.
    var httpContentTypeAllowlist: [String] { get }

    /// Default list of HTTP headers to not capture for network request and response.
    var defaultHttpHeadersBlocklist: [String] { get }

    /// The maximum length of a custom event. Defaults to 64 chars.
    var maxEventNameLength: Int { get }

    /// The regex to validate a custom event name.
    var customEventNameRegex: String { get }

    /// The maximum length of user defined attribute key. Defaults to 256 chars.
    var maxUserDefinedAttributeKeyLength: Int { get }

    /// The maximum length of a user defined attribute value. Defaults to 256 chars.
    var maxUserDefinedAttributeValueLength: Int { get }

    /// The maximum number of user defined attributes for an event. Defaults to 100.
    var maxUserDefinedAttributesPerEvent: Int { get }

    /// All `EventType`s that are always exported, regardless of other filters like session sampling rate and whether the session crashed or not.
    var eventTypeExportAllowList: [EventType] { get }

    /// The color of the mask to apply to the screenshot. The value should be a hex color string. For example, "#222222".
    var screenshotMaskHexColor: String { get }

    /// The compression quality of the screenshot. Must be between 0 and 100, where 0 is lowest quality and smallest size while 100 is highest quality and largest size.
    var screenshotCompressionQuality: Int { get }

    /// The time interval (in milliseconds) that must pass before a new layout snapshot can be generated. Defaults to 750 ms.
    var layoutSnapshotDebounceInterval: Number { get }

    /// Max length of a span name. Defaults to 64.
    var maxSpanNameLength: Int { get }

    /// Max length of a checkpoint name. Defaults to 64.
    var maxCheckpointNameLength: Int { get }

    /// Max checkpoints per span. Defaults to 100.
    var maxCheckpointsPerSpan: Int { get }
}
