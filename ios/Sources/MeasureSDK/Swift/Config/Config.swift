//
//  Config.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Represents the configuration for initializing the Measure SDK.
///
/// The `Config` struct is used to specify the settings for the Measure SDK. It includes properties
/// that control various aspects of the SDK's behavior.
///
/// - Note: If no values are provided during initialization, the struct will use default values specified in `DefaultConfig` where applicable.
///
struct Config: InternalConfig, MeasureConfig {
    let batchExportIntervalMs: Number
    let attachmentExportIntervalMs: Number
    let eventsBatchingIntervalMs: Number
    let defaultHttpHeadersBlocklist: [String]
    let sessionBackgroundTimeoutThresholdMs: Number
    let maxEventNameLength: Number
    let maxUserDefinedAttributesPerEvent: Number
    let customEventNameRegex: String
    let maxUserDefinedAttributeKeyLength: Number
    let maxUserDefinedAttributeValueLength: Number
    let sessionEndLastEventThresholdMs: Number
    let longPressTimeout: TimeInterval
    let scaledTouchSlop: CGFloat
    let maxAttachmentSizeInEventsBatchInBytes: Number
    let timeoutIntervalForRequest: TimeInterval
    let cpuTrackingIntervalMs: UnsignedNumber
    let memoryTrackingIntervalMs: UnsignedNumber
    let httpContentTypeAllowlist: [String]
    let screenshotMaskHexColor: String
    let screenshotCompressionQuality: Number
    let eventTypeExportAllowList: [EventType]
    let maxSpanNameLength: Number
    let maxCheckpointNameLength: Number
    let maxCheckpointsPerSpan: Number
    let maxInMemorySignalsQueueSize: Number
    let inMemorySignalsQueueFlushRateMs: Number
    let maxAttachmentsInBugReport: Number
    let maxDescriptionLengthInBugReport: Number
    let shakeAccelerationThreshold: Float
    let shakeMinTimeIntervalMs: Number
    let shakeSlop: Number
    let disallowedCustomHeaders: [String]
    let estimatedEventSizeInKb: Number
    let layoutSnapshotDebounceInterval: Number
    let accelerometerUpdateInterval: TimeInterval
    let lifecycleViewControllerExcludeList: [String]
    let maxExportJitterInterval: Number
    let maxAttachmentsInBatch: Number
    let maxBodySizeBytes: Number
    let enableLogging: Bool
    let autoStart: Bool
    let enableFullCollectionMode: Bool
    let requestHeadersProvider: MsrRequestHeadersProvider?
    let maxDiskUsageInMb: Number
    
    init(enableLogging: Bool = DefaultConfig.enableLogging, // swiftlint:disable:this function_body_length
         autoStart: Bool = DefaultConfig.autoStart,
         enableFullCollectionMode: Bool = DefaultConfig.enableFullCollectionMode,
         requestHeadersProvider: MsrRequestHeadersProvider? = nil,
         maxDiskUsageInMb: Number = DefaultConfig.maxDiskUsageInMb) {
        self.enableLogging = enableLogging
        self.autoStart = autoStart
        self.enableFullCollectionMode = enableFullCollectionMode
        self.requestHeadersProvider = requestHeadersProvider
        self.maxDiskUsageInMb = maxDiskUsageInMb
        self.batchExportIntervalMs = 3_000 // 3 seconds
        self.attachmentExportIntervalMs = 500 // 500 ms
        self.defaultHttpHeadersBlocklist = ["Authorization",
                                             "Cookie",
                                             "Set-Cookie",
                                             "Proxy-Authorization",
                                             "WWW-Authenticate",
                                             "X-Api-Key"]
        self.sessionBackgroundTimeoutThresholdMs = 30_000 // 30 seconds
        self.maxEventNameLength = 64 // 64 chars
        self.maxUserDefinedAttributesPerEvent = 100
        self.customEventNameRegex = "^[a-zA-Z0-9_-]+$"
        self.maxUserDefinedAttributeKeyLength = 256 // 256 chars
        self.maxUserDefinedAttributeValueLength = 256 // 256 chars
        self.longPressTimeout = 500 // 500 ms
        self.scaledTouchSlop = 3.5 // 3.5 points
        self.screenshotMaskHexColor = "#222222"
        self.screenshotCompressionQuality = 25
        self.eventTypeExportAllowList = [.sessionStart]
        self.maxSpanNameLength = 64
        self.maxCheckpointNameLength = 64
        self.maxCheckpointsPerSpan = 100
        self.maxInMemorySignalsQueueSize = 30
        self.inMemorySignalsQueueFlushRateMs = 3_000
        self.maxAttachmentsInBugReport = 5
        self.maxDescriptionLengthInBugReport = 4000
        self.shakeAccelerationThreshold = 2.5
        self.shakeMinTimeIntervalMs = 1500
        self.shakeSlop = 2
        self.disallowedCustomHeaders = DefaultConfig.disallowedCustomHeaders
        self.estimatedEventSizeInKb = 2 // 2kb
        // iOS specific
        self.accelerometerUpdateInterval = 0.1
        self.lifecycleViewControllerExcludeList = [
                    "UIHostingController",
                    "UIKitNavigationController",
                    "NavigationStackHostingController",
                    "NotifyingMulticolumnSplitViewController",
                    "StyleContextSplitViewController",
                    "UISystemAssistantViewController",
                    "UISystemKeyboardDockController",
                    "UIEditingOverlayViewController",
                    "UIInputWindowContoller",
                    "PrewarmingViewController",
                    "UIInputViewController",
                    "UICompactibilityInputViewController",
                    "UICompactibilityInputViewController",
                    "UIPredictionViewController",
                    "_UICursorAccessoryViewController",
                    "UIMultiscriptCandidateViewController",
                    "_UIContextMenuActionsOnlyViewController",
                    "_UIAlertControllerTextFieldViewController",
                    "UIInputWindowController",
                    "UICompatibilityInputViewController",
                    "UISystemInputAssistantViewController"
                ]
        // TODO: check if this is needed in android
        self.layoutSnapshotDebounceInterval = 750 // 750 ms
        // TODO: to remove
        self.maxExportJitterInterval = 20
        self.maxAttachmentsInBatch = 10
        self.maxBodySizeBytes = 3_000_000
        self.sessionEndLastEventThresholdMs = 123213
        self.maxAttachmentSizeInEventsBatchInBytes = 123123
        self.timeoutIntervalForRequest = 123123
        self.cpuTrackingIntervalMs = 123123
        self.memoryTrackingIntervalMs = 123123
        self.httpContentTypeAllowlist = [""]
        self.eventsBatchingIntervalMs = 12312
    }
}
