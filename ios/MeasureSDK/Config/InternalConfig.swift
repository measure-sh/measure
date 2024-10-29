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
}
