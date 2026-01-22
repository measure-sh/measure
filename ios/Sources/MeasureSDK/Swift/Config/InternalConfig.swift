//
//  InternalConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Internal configuration options for the Measure SDK.
protocol InternalConfig {
    /// The interval between consecutive requests for batch export.
    var batchExportIntervalMs: Number { get }
    
    /// The interval between consecutive requests for attachment export.
    var attachmentExportIntervalMs: Number { get }

    /// Default list of HTTP headers to not capture for network request and response.
    var defaultHttpHeadersBlocklist: [String] { get }

    /// Starts a new session when app comes back to foreground after this threshold.
    /// Defaults to 30 seconds.
    var sessionBackgroundTimeoutThresholdMs: Number { get }

    /// The maximum length of a custom event. Defaults to 64 chars.
    var maxEventNameLength: Number { get }

    /// The maximum number of user defined attributes for an event. Defaults to 100.
    var maxUserDefinedAttributesPerEvent: Number { get }

    /// The regex to validate a custom event name.
    var customEventNameRegex: String { get }

    /// The maximum length of user defined attribute key. Defaults to 256 chars.
    var maxUserDefinedAttributeKeyLength: Number { get }

    /// The maximum length of a user defined attribute value. Defaults to 256 chars.
    var maxUserDefinedAttributeValueLength: Number { get }

    /// The threshold to determine long press. Defaults to 500 ms.
    var longPressTimeout: TimeInterval { get }

    /// The minimum movement before a touch is detected as a scroll. Defaults to 20 points.
    var scaledTouchSlop: CGFloat { get }

    /// The color of the mask to apply to the screenshot. The value should be a hex color string. For example, "#222222".
    var screenshotMaskHexColor: String { get }

    /// The compression quality of the screenshot. Must be between 0 and 100, where 0 is lowest quality and smallest size while 100 is highest quality and largest size.
    var screenshotCompressionQuality: Number { get }

    /// All `EventType`s that are always exported, regardless of other filters like session sampling rate and whether the session crashed or not.
    var eventTypeExportAllowList: [EventType] { get }

    /// Max length of a span name. Defaults to 64.
    var maxSpanNameLength: Number { get }

    /// Max length of a checkpoint name. Defaults to 64.
    var maxCheckpointNameLength: Number { get }

    /// Max checkpoints per span. Defaults to 100.
    var maxCheckpointsPerSpan: Number { get }

    /// Maximum number of signals (events and spans) in the in memory queue. Defaults to 30.
    var maxInMemorySignalsQueueSize: Number { get }
    
    /// The timeout after which signals are attempted to be flushed to disk in milliseconds.
    /// Defaults to 3000ms.
    var inMemorySignalsQueueFlushRateMs: Number { get }

    /// The maximum number of attachments allowed in a bug report. Defaults to 5.
    var maxAttachmentsInBugReport: Number { get }

    /// The maximum number of characters allowed in the bug report description. Defaults to 4000.
    var maxDescriptionLengthInBugReport: Number { get }

    /// The force threshold to trigger a shake (higher = less sensitive). Defaults to 2.5.
    var shakeAccelerationThreshold: Float { get }

    /// Minimum time between shake detections in milliseconds. Defaults to 1500 ms.
    var shakeMinTimeIntervalMs: Number { get }

    /// List of custom headers that should not be included.
    var disallowedCustomHeaders: [String] { get }

    /// The estimated size of one event on disk.
    var estimatedEventSizeInKb: Number { get }

    /// The interval, in seconds, for providing accelerometer updates to the block handler. Defaults to 0.1 seconds.
    var accelerometerUpdateInterval: TimeInterval { get }

    /// List of ViewController names that should not be tracked by LifecycleCollector
    var lifecycleViewControllerExcludeList: [String] { get }

    // TODO: this is not in android. check if its needed to be added in config or in LayoutSnapshotThrottler
    /// The time interval (in milliseconds) that must pass before a new layout snapshot can be generated. Defaults to 750 ms.
    var layoutSnapshotDebounceInterval: Number { get }

    /// The request timeout interval for all tasks within sessions based on this configuration
    var timeoutIntervalForRequest: TimeInterval { get }

    /// The maximum size of response or request body in `HttpData`. Defaults to 256 x 1024 bytes
    var maxBodySizeBytes: Number { get }
}
