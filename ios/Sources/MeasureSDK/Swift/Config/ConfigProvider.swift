//
//  ConfigProvider.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Configuration Provider for the Measure SDK. See `BaseConfigProvider` for details.
protocol ConfigProvider: MeasureConfig, InternalConfig, DynamicConfig {
    func shouldTrackHttpBody(url: String, contentType: String?) -> Bool
    func shouldTrackHttpUrl(url: String) -> Bool
    func shouldTrackHttpHeader(key: String) -> Bool

    /// Sets the measure URL so that it can be added to the httpUrlBlocklist. Required as it can be any
    /// URL when the SDK is running in self-hosted mode.
    /// - Parameter url: The base URL of the Measure service.
    func setMeasureUrl(url: String)

    /// Updates the dynamic configuration at runtime.
    func setDynamicConfig(_ config: DynamicConfig)
}

/// A configuration provider for the Measure SDK.
///
/// The `BaseConfigProvider` class is responsible for managing and providing configuration settings
/// for the Measure SDK. It follows a priority hierarchy to determine the most up-to-date configuration:
///
/// Network Configuration: If a network configuration is available, it takes precedence and is used.
/// Cached Configuration: If no network configuration is available, the cached configuration is used.
/// Default Configuration: If neither network nor cached configurations are available, the default configuration is applied.
/// 
final class BaseConfigProvider: ConfigProvider {
    private let defaultConfig: Config

    private let lockQueue = DispatchQueue(label: "sh.measure.config-provider")

    private var dynamicConfig: DynamicConfig = BaseDynamicConfig.default()

    init(defaultConfig: Config) {
        self.defaultConfig = defaultConfig
    }

    func setDynamicConfig(_ config: DynamicConfig) {
        lockQueue.async {
            self.dynamicConfig = config
        }
    }

    // MeasureConfig

    var enableLogging: Bool { defaultConfig.enableLogging }
    var autoStart: Bool { defaultConfig.autoStart }
    var enableFullCollectionMode: Bool { defaultConfig.enableFullCollectionMode }
    var requestHeadersProvider: MsrRequestHeadersProvider? { defaultConfig.requestHeadersProvider }
    var maxDiskUsageInMb: Number { defaultConfig.maxDiskUsageInMb }

    // InternalConfig

    var batchExportIntervalMs: Number { defaultConfig.batchExportIntervalMs }
    var attachmentExportIntervalMs: Number { defaultConfig.attachmentExportIntervalMs }
    var defaultHttpHeadersBlocklist: [String] { defaultConfig.defaultHttpHeadersBlocklist }
    var sessionBackgroundTimeoutThresholdMs: Number { defaultConfig.sessionBackgroundTimeoutThresholdMs }
    var maxEventNameLength: Number { defaultConfig.maxEventNameLength }
    var maxUserDefinedAttributesPerEvent: Number { defaultConfig.maxUserDefinedAttributesPerEvent }
    var customEventNameRegex: String { defaultConfig.customEventNameRegex }
    var maxUserDefinedAttributeKeyLength: Number { defaultConfig.maxUserDefinedAttributeKeyLength }
    var maxUserDefinedAttributeValueLength: Number { defaultConfig.maxUserDefinedAttributeValueLength }
    var longPressTimeout: TimeInterval { defaultConfig.longPressTimeout }
    var scaledTouchSlop: CGFloat { defaultConfig.scaledTouchSlop }
    var screenshotMaskHexColor: String { defaultConfig.screenshotMaskHexColor }
    var screenshotCompressionQuality: Number { defaultConfig.screenshotCompressionQuality }
    var eventTypeExportAllowList: [EventType] { defaultConfig.eventTypeExportAllowList }
    var maxSpanNameLength: Number { defaultConfig.maxSpanNameLength }
    var maxCheckpointNameLength: Number { defaultConfig.maxCheckpointNameLength }
    var maxCheckpointsPerSpan: Number { defaultConfig.maxCheckpointsPerSpan }
    var maxInMemorySignalsQueueSize: Number { defaultConfig.maxInMemorySignalsQueueSize }
    var inMemorySignalsQueueFlushRateMs: Number { defaultConfig.inMemorySignalsQueueFlushRateMs }
    var maxAttachmentsInBugReport: Number { defaultConfig.maxAttachmentsInBugReport }
    var maxDescriptionLengthInBugReport: Number { defaultConfig.maxDescriptionLengthInBugReport }
    var shakeAccelerationThreshold: Float { defaultConfig.shakeAccelerationThreshold }
    var shakeMinTimeIntervalMs: Number { defaultConfig.shakeMinTimeIntervalMs }
    var shakeSlop: Number { defaultConfig.shakeSlop }
    var disallowedCustomHeaders: [String] { defaultConfig.disallowedCustomHeaders }
    var estimatedEventSizeInKb: Number { defaultConfig.estimatedEventSizeInKb }
    var sessionEndLastEventThresholdMs: Number { defaultConfig.sessionEndLastEventThresholdMs }
    var layoutSnapshotDebounceInterval: Number { defaultConfig.layoutSnapshotDebounceInterval }
    var accelerometerUpdateInterval: TimeInterval { defaultConfig.accelerometerUpdateInterval }
    var lifecycleViewControllerExcludeList: [String] { defaultConfig.lifecycleViewControllerExcludeList }
    var maxExportJitterInterval: Number { defaultConfig.maxExportJitterInterval }
    var maxAttachmentsInBatch: Number { defaultConfig.maxAttachmentsInBatch }
    var maxBodySizeBytes: Number { defaultConfig.maxBodySizeBytes }
    var eventsBatchingIntervalMs: Number { defaultConfig.eventsBatchingIntervalMs }
    var maxAttachmentSizeInEventsBatchInBytes: Number { defaultConfig.maxAttachmentSizeInEventsBatchInBytes }
    var timeoutIntervalForRequest: TimeInterval { defaultConfig.timeoutIntervalForRequest }
    var httpContentTypeAllowlist: [String] { defaultConfig.httpContentTypeAllowlist }

    // DynamicConfig

    var maxEventsInBatch: Number { dynamicConfig.maxEventsInBatch }
    var crashTimelineDurationSeconds: Number {
        dynamicConfig.crashTimelineDurationSeconds
    }
    var anrTimelineDurationSeconds: Number {
        dynamicConfig.anrTimelineDurationSeconds
    }
    var bugReportTimelineDurationSeconds: Number {
        dynamicConfig.bugReportTimelineDurationSeconds
    }
    var traceSamplingRate: Float { dynamicConfig.traceSamplingRate }
    var journeySamplingRate: Float {
        dynamicConfig.journeySamplingRate
    }
    var screenshotMaskLevel: ScreenshotMaskLevel {
        dynamicConfig.screenshotMaskLevel
    }
    var cpuUsageInterval: Number {
        dynamicConfig.cpuUsageInterval
    }
    var memoryUsageInterval: Number {
        dynamicConfig.memoryUsageInterval
    }
    var crashTakeScreenshot: Bool {
        dynamicConfig.crashTakeScreenshot
    }
    var anrTakeScreenshot: Bool {
        dynamicConfig.anrTakeScreenshot
    }
    var launchSamplingRate: Float {
        dynamicConfig.launchSamplingRate
    }
    var gestureClickTakeSnapshot: Bool {
        dynamicConfig.gestureClickTakeSnapshot
    }
    var httpDisableEventForUrls: [String] {
        dynamicConfig.httpDisableEventForUrls
    }
    var httpTrackRequestForUrls: [String] {
        dynamicConfig.httpTrackRequestForUrls
    }
    var httpTrackResponseForUrls: [String] {
        dynamicConfig.httpTrackResponseForUrls
    }
    var httpBlockedHeaders: [String] {
        dynamicConfig.httpBlockedHeaders
    }

    func shouldTrackHttpBody(url: String, contentType: String?) -> Bool {
        // TODO: Implement this
        return true
    }

    func shouldTrackHttpUrl(url: String) -> Bool {
        // TODO: Implement this
        return true
    }

    func shouldTrackHttpHeader(key: String) -> Bool {
        // TODO: Implement this
        return true
    }

    func setMeasureUrl(url: String) {
        // TODO: Implement this
    }
}
