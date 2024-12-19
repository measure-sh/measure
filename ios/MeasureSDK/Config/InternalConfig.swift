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

    /// The threshold to determine long press. Defaults to 0.5 second.
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
}
