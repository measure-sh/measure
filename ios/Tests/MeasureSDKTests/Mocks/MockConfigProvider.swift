//
//  MockConfigProvider.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import Measure

final class MockConfigProvider: ConfigProvider {
    var enableLogging: Bool
    var autoStart: Bool
    var enableFullCollectionMode: Bool
    var requestHeadersProvider: MsrRequestHeadersProvider?
    var maxDiskUsageInMb: Number
    var batchExportIntervalMs: Number
    var attachmentExportIntervalMs: Number
    var defaultHttpHeadersBlocklist: [String]
    var sessionBackgroundTimeoutThresholdMs: Number
    var maxEventNameLength: Number
    var maxUserDefinedAttributesPerEvent: Number
    var customEventNameRegex: String
    var maxUserDefinedAttributeKeyLength: Number
    var maxUserDefinedAttributeValueLength: Number
    var longPressTimeout: TimeInterval
    var scaledTouchSlop: CGFloat
    var screenshotMaskHexColor: String
    var screenshotCompressionQuality: Number
    var maxSpanNameLength: Number
    var maxCheckpointNameLength: Number
    var maxCheckpointsPerSpan: Number
    var maxInMemorySignalsQueueSize: Number
    var inMemorySignalsQueueFlushRateMs: Number
    var maxAttachmentsInBugReport: Number
    var maxDescriptionLengthInBugReport: Number
    var shakeAccelerationThreshold: Float
    var shakeMinTimeIntervalMs: Number
    var shakeSlop: Number
    var disallowedCustomHeaders: [String]
    var estimatedEventSizeInKb: Number
    var layoutSnapshotDebounceInterval: Number
    var accelerometerUpdateInterval: TimeInterval
    var lifecycleViewControllerExcludeList: [String]
    var maxExportJitterInterval: Number
    var maxAttachmentsInBatch: Number
    var maxBodySizeBytes: Number
    var eventsBatchingIntervalMs: Number
    var maxAttachmentSizeInEventsBatchInBytes: Number
    var timeoutIntervalForRequest: TimeInterval
    var httpContentTypeAllowlist: [String]
    var maxEventsInBatch: Number
    var crashTimelineDurationSeconds: Number
    var anrTimelineDurationSeconds: Number
    var bugReportTimelineDurationSeconds: Number
    var traceSamplingRate: Float
    var journeySamplingRate: Float
    var screenshotMaskLevel: ScreenshotMaskLevel
    var cpuUsageInterval: Number
    var memoryUsageInterval: Number
    var crashTakeScreenshot: Bool
    var anrTakeScreenshot: Bool
    var launchSamplingRate: Float
    var gestureClickTakeSnapshot: Bool
    var httpDisableEventForUrls: [String]
    var httpTrackRequestForUrls: [String]
    var httpTrackResponseForUrls: [String]
    var httpBlockedHeaders: [String]
    var dynamicConfig: DynamicConfig?
    var combinedHttpHeadersBlocklist: [String]
    var combinedHttpUrlBlocklist: [String] = []
    var httpUrlBlocklist: [String]

    init(enableLogging: Bool = false,
         autoStart: Bool = true,
         enableFullCollectionMode: Bool = false,
         requestHeadersProvider: MsrRequestHeadersProvider? = nil,
         maxDiskUsageInMb: Number = 50,
         batchExportIntervalMs: Number = 3_000,
         attachmentExportIntervalMs: Number = 500,
         eventsBatchingIntervalMs: Number = 12_312,
         defaultHttpHeadersBlocklist: [String] = DefaultConfig.disallowedCustomHeaders,
         sessionBackgroundTimeoutThresholdMs: Number = 30_000,
         maxEventNameLength: Number = 64,
         maxUserDefinedAttributesPerEvent: Number = 100,
         customEventNameRegex: String = "^[a-zA-Z0-9_-]+$",
         maxUserDefinedAttributeKeyLength: Number = 256,
         maxUserDefinedAttributeValueLength: Number = 256,
         longPressTimeout: TimeInterval = 500,
         scaledTouchSlop: CGFloat = 3.5,
         screenshotMaskHexColor: String = "#222222",
         screenshotCompressionQuality: Number = 25,
         maxSpanNameLength: Number = 64,
         maxCheckpointNameLength: Number = 64,
         maxCheckpointsPerSpan: Number = 100,
         maxInMemorySignalsQueueSize: Number = 30,
         inMemorySignalsQueueFlushRateMs: Number = 3_000,
         maxAttachmentsInBugReport: Number = 5,
         maxDescriptionLengthInBugReport: Number = 4_000,
         shakeAccelerationThreshold: Float = 2.5,
         shakeMinTimeIntervalMs: Number = 1_500,
         shakeSlop: Number = 2,
         disallowedCustomHeaders: [String] = DefaultConfig.disallowedCustomHeaders,
         estimatedEventSizeInKb: Number = 2,
         layoutSnapshotDebounceInterval: Number = 750,
         accelerometerUpdateInterval: TimeInterval = 0.1,
         lifecycleViewControllerExcludeList: [String] = [
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
         ],
         maxExportJitterInterval: Number = 20,
         maxAttachmentsInBatch: Number = 10,
         maxBodySizeBytes: Number = 3_000_000,
         maxAttachmentSizeInEventsBatchInBytes: Number = 123_123,
         timeoutIntervalForRequest: TimeInterval = 123_123,
         httpContentTypeAllowlist: [String] = ["application/json"],
         dynamicConfig: DynamicConfig = BaseDynamicConfig.default(),
         combinedHttpUrlBlocklist: [String] = [],
         maxEventsInBatch: Number = 10_000,
         crashTimelineDurationSeconds: Number = 300,
         anrTimelineDurationSeconds: Number = 300,
         bugReportTimelineDurationSeconds: Number = 300,
         traceSamplingRate: Float = 0.01,
         journeySamplingRate: Float = 0.01,
         screenshotMaskLevel: ScreenshotMaskLevel = .allTextAndMedia,
         cpuUsageInterval: Number = 5,
         memoryUsageInterval: Number = 5,
         crashTakeScreenshot: Bool = true,
         anrTakeScreenshot: Bool = true,
         launchSamplingRate: Float = 0.01,
         gestureClickTakeSnapshot: Bool = true,
         httpDisableEventForUrls: [String] = [],
         httpTrackRequestForUrls: [String] = [],
         httpTrackResponseForUrls: [String] = [],
         httpBlockedHeaders: [String] = [
            "Authorization",
            "Cookie",
            "Set-Cookie",
            "Proxy-Authorization",
            "WWW-Authenticate",
            "X-Api-Key",
         ],
         httpUrlBlocklist: [String] = ["https://storage.googleapis.com/"]) {
        self.enableLogging = enableLogging
        self.autoStart = autoStart
        self.enableFullCollectionMode = enableFullCollectionMode
        self.requestHeadersProvider = requestHeadersProvider
        self.maxDiskUsageInMb = maxDiskUsageInMb
        self.batchExportIntervalMs = batchExportIntervalMs
        self.attachmentExportIntervalMs = attachmentExportIntervalMs
        self.eventsBatchingIntervalMs = eventsBatchingIntervalMs
        self.defaultHttpHeadersBlocklist = defaultHttpHeadersBlocklist
        self.sessionBackgroundTimeoutThresholdMs = sessionBackgroundTimeoutThresholdMs
        self.maxEventNameLength = maxEventNameLength
        self.maxUserDefinedAttributesPerEvent = maxUserDefinedAttributesPerEvent
        self.customEventNameRegex = customEventNameRegex
        self.maxUserDefinedAttributeKeyLength = maxUserDefinedAttributeKeyLength
        self.maxUserDefinedAttributeValueLength = maxUserDefinedAttributeValueLength
        self.longPressTimeout = longPressTimeout
        self.scaledTouchSlop = scaledTouchSlop
        self.screenshotMaskHexColor = screenshotMaskHexColor
        self.screenshotCompressionQuality = screenshotCompressionQuality
        self.maxSpanNameLength = maxSpanNameLength
        self.maxCheckpointNameLength = maxCheckpointNameLength
        self.maxCheckpointsPerSpan = maxCheckpointsPerSpan
        self.maxInMemorySignalsQueueSize = maxInMemorySignalsQueueSize
        self.inMemorySignalsQueueFlushRateMs = inMemorySignalsQueueFlushRateMs
        self.maxAttachmentsInBugReport = maxAttachmentsInBugReport
        self.maxDescriptionLengthInBugReport = maxDescriptionLengthInBugReport
        self.shakeAccelerationThreshold = shakeAccelerationThreshold
        self.shakeMinTimeIntervalMs = shakeMinTimeIntervalMs
        self.shakeSlop = shakeSlop
        self.disallowedCustomHeaders = disallowedCustomHeaders
        self.estimatedEventSizeInKb = estimatedEventSizeInKb
        self.layoutSnapshotDebounceInterval = layoutSnapshotDebounceInterval
        self.accelerometerUpdateInterval = accelerometerUpdateInterval
        self.lifecycleViewControllerExcludeList = lifecycleViewControllerExcludeList
        self.maxExportJitterInterval = maxExportJitterInterval
        self.maxAttachmentsInBatch = maxAttachmentsInBatch
        self.maxBodySizeBytes = maxBodySizeBytes
        self.maxAttachmentSizeInEventsBatchInBytes = maxAttachmentSizeInEventsBatchInBytes
        self.timeoutIntervalForRequest = timeoutIntervalForRequest
        self.httpContentTypeAllowlist = httpContentTypeAllowlist
        self.dynamicConfig = dynamicConfig
        self.combinedHttpUrlBlocklist = combinedHttpUrlBlocklist
        self.combinedHttpHeadersBlocklist = defaultHttpHeadersBlocklist + dynamicConfig.httpBlockedHeaders
        self.maxEventsInBatch = maxEventsInBatch
        self.crashTimelineDurationSeconds = crashTimelineDurationSeconds
        self.anrTimelineDurationSeconds = anrTimelineDurationSeconds
        self.bugReportTimelineDurationSeconds = bugReportTimelineDurationSeconds
        self.traceSamplingRate = traceSamplingRate
        self.journeySamplingRate = journeySamplingRate
        self.screenshotMaskLevel = screenshotMaskLevel
        self.cpuUsageInterval = cpuUsageInterval
        self.memoryUsageInterval = memoryUsageInterval
        self.crashTakeScreenshot = crashTakeScreenshot
        self.anrTakeScreenshot = anrTakeScreenshot
        self.launchSamplingRate = launchSamplingRate
        self.gestureClickTakeSnapshot = gestureClickTakeSnapshot
        self.httpDisableEventForUrls = httpDisableEventForUrls
        self.httpTrackRequestForUrls = httpTrackRequestForUrls
        self.httpTrackResponseForUrls = httpTrackResponseForUrls
        self.httpBlockedHeaders = httpBlockedHeaders
        self.httpUrlBlocklist = httpUrlBlocklist
    }


    func setMeasureUrl(url: String) {
        combinedHttpUrlBlocklist.append(url)
    }

    func setDynamicConfig(_ config: DynamicConfig) {
        self.dynamicConfig = config
        self.combinedHttpHeadersBlocklist =
            defaultHttpHeadersBlocklist + config.httpBlockedHeaders
    }

    func shouldTrackHttpBody(url: String, contentType: String?) -> Bool {
        guard
            let contentType,
            !contentType.isEmpty,
            shouldTrackHttpUrl(url: url)
        else { return false }

        return httpContentTypeAllowlist.contains {
            contentType.lowercased().hasPrefix($0.lowercased())
        }
    }

    func shouldTrackHttpUrl(url: String) -> Bool {
        !combinedHttpUrlBlocklist.contains {
            url.range(of: $0, options: .caseInsensitive) != nil
        }
    }

    func shouldTrackHttpHeader(key: String) -> Bool {
        !combinedHttpHeadersBlocklist.contains {
            key.range(of: $0, options: .caseInsensitive) != nil
        }
    }
}
