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
    private struct HttpPatternState {
        let disableEventPatterns: [NSRegularExpression]
        let blocklistPatterns: [NSRegularExpression]
        let trackRequestPatterns: [NSRegularExpression]
        let trackResponsePatterns: [NSRegularExpression]
        let blockedHeaders: [String]
        let measureUrl: String?
    }
    private let defaultConfig: Config
    private let lockQueue = DispatchQueue(label: "sh.measure.config-provider")
    private var dynamicConfig: DynamicConfig = BaseDynamicConfig()
    private var httpPatternState = HttpPatternState(
        disableEventPatterns: [],
        blocklistPatterns: [],
        trackRequestPatterns: [],
        trackResponsePatterns: [],
        blockedHeaders: [],
        measureUrl: nil
    )

    init(defaultConfig: Config) {
        self.defaultConfig = defaultConfig
    }

    func setDynamicConfig(_ config: DynamicConfig) {
        lockQueue.sync {
            self.dynamicConfig = config

            let measureUrl = self.httpPatternState.measureUrl

            self.httpPatternState = HttpPatternState(
                disableEventPatterns: self.buildDisableEventPatterns(
                    configUrls: config.httpDisableEventForUrls,
                    measureUrl: measureUrl
                ),
                blocklistPatterns: self.httpUrlBlocklist.map(self.compilePattern),
                trackRequestPatterns: config.httpTrackRequestForUrls.map(self.compilePattern),
                trackResponsePatterns: config.httpTrackResponseForUrls.map(self.compilePattern),
                blockedHeaders: config.httpBlockedHeaders,
                measureUrl: measureUrl
            )
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
    var maxSpanNameLength: Number { defaultConfig.maxSpanNameLength }
    var maxCheckpointNameLength: Number { defaultConfig.maxCheckpointNameLength }
    var maxCheckpointsPerSpan: Number { defaultConfig.maxCheckpointsPerSpan }
    var maxInMemorySignalsQueueSize: Number { defaultConfig.maxInMemorySignalsQueueSize }
    var inMemorySignalsQueueFlushRateMs: Number { defaultConfig.inMemorySignalsQueueFlushRateMs }
    var maxAttachmentsInBugReport: Number { defaultConfig.maxAttachmentsInBugReport }
    var maxDescriptionLengthInBugReport: Number { defaultConfig.maxDescriptionLengthInBugReport }
    var shakeAccelerationThreshold: Float { defaultConfig.shakeAccelerationThreshold }
    var shakeMinTimeIntervalMs: Number { defaultConfig.shakeMinTimeIntervalMs }
    var disallowedCustomHeaders: [String] { defaultConfig.disallowedCustomHeaders }
    var estimatedEventSizeInKb: Number { defaultConfig.estimatedEventSizeInKb }
    var layoutSnapshotDebounceInterval: Number { defaultConfig.layoutSnapshotDebounceInterval }
    var accelerometerUpdateInterval: TimeInterval { defaultConfig.accelerometerUpdateInterval }
    var lifecycleViewControllerExcludeList: [String] { defaultConfig.lifecycleViewControllerExcludeList }
    var maxBodySizeBytes: Number { defaultConfig.maxBodySizeBytes }
    var timeoutIntervalForRequest: TimeInterval { defaultConfig.timeoutIntervalForRequest }
    var httpUrlBlocklist: [String] { defaultConfig.httpUrlBlocklist }

    // DynamicConfig

    var maxEventsInBatch: Number { dynamicConfig.maxEventsInBatch }
    var crashTimelineDurationSeconds: Number { dynamicConfig.crashTimelineDurationSeconds }
    var anrTimelineDurationSeconds: Number { dynamicConfig.anrTimelineDurationSeconds }
    var bugReportTimelineDurationSeconds: Number { dynamicConfig.bugReportTimelineDurationSeconds }
    var traceSamplingRate: Float { dynamicConfig.traceSamplingRate }
    var journeySamplingRate: Float { dynamicConfig.journeySamplingRate }
    var screenshotMaskLevel: ScreenshotMaskLevel { dynamicConfig.screenshotMaskLevel }
    var cpuUsageInterval: Number { dynamicConfig.cpuUsageInterval }
    var memoryUsageInterval: Number { dynamicConfig.memoryUsageInterval }
    var crashTakeScreenshot: Bool { dynamicConfig.crashTakeScreenshot }
    var anrTakeScreenshot: Bool { dynamicConfig.anrTakeScreenshot }
    var launchSamplingRate: Float { dynamicConfig.launchSamplingRate }
    var gestureClickTakeSnapshot: Bool { dynamicConfig.gestureClickTakeSnapshot }
    var httpSamplingRate: Float { dynamicConfig.httpSamplingRate }
    var httpDisableEventForUrls: [String] { dynamicConfig.httpDisableEventForUrls }
    var httpTrackRequestForUrls: [String] { dynamicConfig.httpTrackRequestForUrls }
    var httpTrackResponseForUrls: [String] { dynamicConfig.httpTrackResponseForUrls }
    var httpBlockedHeaders: [String] { dynamicConfig.httpBlockedHeaders }

    // HTTP Tracking Logic

    func shouldTrackHttpUrl(url: String) -> Bool {
        let state = httpPatternState

        guard let parsedUrl = URL(string: url),
              let host = parsedUrl.host?.lowercased() else {
            return true
        }

        let isBlockedByDomain = httpUrlBlocklist.contains { blockedDomain in
            host.contains(blockedDomain.lowercased())
        }

        if isBlockedByDomain {
            return false
        }

        let range = NSRange(location: 0, length: url.utf16.count)

        if state.disableEventPatterns.contains(where: {
            $0.firstMatch(in: url, options: [], range: range) != nil
        }) {
            return false
        }

        return true
    }

    func shouldTrackHttpBody(url: String, contentType: String?) -> Bool {
        let state = httpPatternState
        let range = NSRange(location: 0, length: url.utf16.count)
        
        return state.trackRequestPatterns.contains {
            $0.firstMatch(in: url, options: [], range: range) != nil
        } || state.trackResponsePatterns.contains {
            $0.firstMatch(in: url, options: [], range: range) != nil
        }
    }

    func shouldTrackHttpHeader(key: String) -> Bool {
        let state = httpPatternState

        let blockedByDefault = defaultHttpHeadersBlocklist.contains {
            $0.caseInsensitiveCompare(key) == .orderedSame
        }

        let blockedByConfig = state.blockedHeaders.contains {
            $0.caseInsensitiveCompare(key) == .orderedSame
        }

        return !blockedByDefault && !blockedByConfig
    }

    func setMeasureUrl(url: String) {
        lockQueue.sync {
            let currentState = self.httpPatternState

            let disablePatterns = self.buildDisableEventPatterns(configUrls: self.dynamicConfig.httpDisableEventForUrls, measureUrl: url)

            self.httpPatternState = HttpPatternState(disableEventPatterns: disablePatterns,
                                                     blocklistPatterns: currentState.blocklistPatterns,
                                                     trackRequestPatterns: currentState.trackRequestPatterns,
                                                     trackResponsePatterns: currentState.trackResponsePatterns,
                                                     blockedHeaders: currentState.blockedHeaders,
                                                     measureUrl: url)
        }
    }

    private func buildDisableEventPatterns(configUrls: [String], measureUrl: String?) -> [NSRegularExpression] {
        let urls = measureUrl != nil ? configUrls + [measureUrl!] : configUrls
        return urls.map(compilePattern)
    }

    private func compilePattern(_ pattern: String) -> NSRegularExpression {
        let escaped = NSRegularExpression.escapedPattern(for: pattern)
        let regexPattern = escaped.replacingOccurrences(of: "\\*", with: ".*")
        
        let finalPattern: String
        if pattern.contains("*") {
            finalPattern = "^" + regexPattern + "$"
        } else {
            // Match base URL and everything under it
            finalPattern = "^" + regexPattern + "(/.*)?$"
        }
        
        do {
            return try NSRegularExpression(pattern: finalPattern, options: [.caseInsensitive])
        } catch {
            return NSRegularExpression()
        }
    }
}
