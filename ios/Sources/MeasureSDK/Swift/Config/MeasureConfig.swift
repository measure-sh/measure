//
//  MeasureConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Configuration for the Measure SDK. See `MeasureConfig` for details.
protocol MeasureConfig {
    var enableLogging: Bool { get }
    var autoStart: Bool { get }
    var enableFullCollectionMode: Bool { get }
    var requestHeadersProvider: MsrRequestHeadersProvider? { get }
    var maxDiskUsageInMb: Number { get }
    var enableDiagnosticMode: Bool { get }
    var enableDiagnosticModeGesture: Bool { get }
    var enableCppThrowSiteCapture: Bool { get }
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
@objc public final class BaseMeasureConfig: NSObject, MeasureConfig, Codable {
    /// Enable or disable internal SDK logs. Defaults to `false`.
    let enableLogging: Bool

    /// Set to false to delay starting the SDK, by default initializing the SDK also starts tracking.
    ///
    /// Defaults to true.
    let autoStart: Bool

    /// Override all sampling configs and track all events and traces.
    /// **Note** that enabling this flag can significantly increase the cost and should typically only be enabled for debug mode.
    let enableFullCollectionMode: Bool

    /// Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API. This is useful only for
    /// self-hosted clients who may require additional headers for requests in their infrastructure.
    let requestHeadersProvider: MsrRequestHeadersProvider?

    /// Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use.
    ///
    /// This is useful to control the amount of disk space used by the SDK for storing session data,
    /// crash reports, and other collected information.
    ///
    /// Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`. Any value outside this
    /// range will be clamped to the nearest limit.
    ///
    /// All Measure SDKs store data to disk and upload it to the server in batches. While the app is
    /// in foreground, the data is synced periodically and usually the disk space used by the SDK is
    /// low. However, if the device is offline or the server is unreachable, the SDK will continue to
    /// store data on disk until it reaches the maximum disk usage limit.
    ///
    /// Note that the storage usage is not exact and works on estimates and typically the SDK will
    /// use much less disk space than the configured limit. When the SDK reaches the maximum disk
    /// usage limit, it will start deleting the oldest data to make space for new data.
    let maxDiskUsageInMb: Number

    /// Enables diagnostic mode which writes all SDK logs to a file.
    /// The log file can be attached when reporting a bug to help with debugging SDK issues.
    /// Defaults to `false`.
    let enableDiagnosticMode: Bool

    /// Enable double finger double tap gesture to export SDK logs via share sheet.
    /// This functionality is only available if `enableDiagnosticMode` is set to `true`.
    /// Defaults to `false`.
    let enableDiagnosticModeGesture: Bool

    /// Records the stack at every C++ `throw`. Turn it on to see the `throw` in crash reports when a
    /// `noexcept` function or a `catch (...)` block stops a C++ exception. With it off, those reports start
    /// at the code that stopped the exception.
    ///
    /// Recording the stack slows down every C++ `throw`, including exceptions your code catches.
    /// Kotlin/Native throws a C++ exception for every Kotlin exception, so keep this off in Kotlin
    /// Multiplatform apps. Defaults to `false`.
    let enableCppThrowSiteCapture: Bool

    let dynamicConfig: BaseDynamicConfig

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
    ///   - autoStart: Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
    ///   - requestHeadersProvider: Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API.
    ///   - maxDiskUsageInMb: Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use. Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`.
    ///   - enableFullCollectionMode: Override all sampling configs and track all events and traces. **Note** that enabling
    ///     this flag can significantly increase the cost and should typically only be enabled for debug mode.
    ///   - enableDiagnosticMode: Enables diagnostic mode which writes all SDK logs to a file. The log file can be attached when reporting a bug to help with debugging SDK issues. Defaults to `false`.
    ///   - enableDiagnosticModeGesture: Enable double finger double tap gesture to export SDK logs via share sheet. This
    ///     functionality is only available if `enableDiagnosticMode` is set to `true`. Defaults to `false`.
    ///   - enableCppThrowSiteCapture: Records the stack at every C++ `throw`, so crash reports show the `throw` when
    ///     a `noexcept` function or a `catch (...)` block stops a C++ exception. Recording the stack slows down every
    ///     C++ `throw`, so keep this off in Kotlin Multiplatform apps. Defaults to `false`.
    ///   - errorFatalTakeScreenshot: Whether to take a screenshot when a fatal error occurs. Defaults to `true`.
    ///   - errorFatalReplayEnabled: Whether to collect a session replay with fatal errors. Defaults to `true`.
    ///   - errorUnhandledReplayEnabled: Whether to collect a session replay with unhandled errors. Defaults to `false`.
    ///   - errorHandledReplayEnabled: Whether to collect a session replay with handled errors. Defaults to `false`.
    ///   - errorReplayDuration: Duration of the session replay collected with an error, in seconds. Defaults to `300`.
    ///   - errorFatalSamplingRate: Sampling rate for fatal errors. Defaults to `100`.
    ///   - errorUnhandledSamplingRate: Sampling rate for unhandled errors. Defaults to `100`.
    ///   - errorHandledSamplingRate: Sampling rate for handled errors. Defaults to `0`.
    ///   - appHangThresholdMillis: How long the main thread must be blocked to report an app hang, in milliseconds. Defaults to `2000`.
    ///   - appHangTimelineDuration: Duration of the session replay collected with an app hang, in seconds. Defaults to `300`.
    ///   - appHangSamplingRate: Sampling rate for app hangs. Defaults to `100`.
    ///   - appHangReplayEnabled: Whether to collect a session replay with app hangs. Defaults to `true`.
    ///   - bugReportTimelineDuration: Duration of the session replay collected with a bug report, in seconds. Defaults to `300`.
    ///   - traceSamplingRate: Sampling rate for traces. Defaults to `100`.
    ///   - ttidTraceEnabled: Whether to collect screen load (TTID) spans. Defaults to `true`.
    ///   - launchSamplingRate: Sampling rate for launch metrics. Defaults to `100`.
    ///   - analyticsSamplingRate: Sampling rate for installations that send analytics events. Defaults to `100`.
    ///   - memoryUsageInterval: Interval to collect memory usage, in seconds. Defaults to `5`.
    ///   - memoryUsageSessionSamplingRate: Sampling rate for sessions that report memory usage. Defaults to `0.01`.
    ///   - httpSamplingRate: Sampling rate for HTTP events. Defaults to `100`.
    ///   - httpDisableEventForUrls: URLs to not collect HTTP events for. Supports `*` wildcards. Defaults to none.
    ///   - httpTrackRequestForUrls: URLs to collect the HTTP request body for. Supports `*` wildcards. Defaults to none.
    ///   - httpTrackResponseForUrls: URLs to collect the HTTP response body for. Supports `*` wildcards. Defaults to none.
    ///   - httpBlockedHeaders: HTTP headers to never collect. Defaults to common auth and cookie headers.
    ///   - screenshotMaskLevel: How much of a screenshot to mask. Defaults to `.allTextAndMedia`.
    ///   - logAutocollectEnabled: Whether to collect logs from the platform's logging APIs automatically. Defaults to `false`.
    ///   - logMinSeverity: Minimum severity of logs to collect. Defaults to `.warning`.
    ///   - logIgnorePatterns: Regex patterns matched against the log body. Logs that match are dropped. Defaults to none.
    public init(enableLogging: Bool? = nil, // swiftlint:disable:this function_body_length
                autoStart: Bool? = nil,
                requestHeadersProvider: MsrRequestHeadersProvider? = nil,
                maxDiskUsageInMb: Int? = nil,
                enableFullCollectionMode: Bool? = nil,
                enableDiagnosticMode: Bool? = nil,
                enableDiagnosticModeGesture: Bool? = nil,
                enableCppThrowSiteCapture: Bool? = nil,
                errorFatalTakeScreenshot: Bool? = nil,
                errorFatalReplayEnabled: Bool? = nil,
                errorUnhandledReplayEnabled: Bool? = nil,
                errorHandledReplayEnabled: Bool? = nil,
                errorReplayDuration: Int? = nil,
                errorFatalSamplingRate: Float? = nil,
                errorUnhandledSamplingRate: Float? = nil,
                errorHandledSamplingRate: Float? = nil,
                appHangThresholdMillis: Int? = nil,
                appHangTimelineDuration: Int? = nil,
                appHangSamplingRate: Float? = nil,
                appHangReplayEnabled: Bool? = nil,
                bugReportTimelineDuration: Int? = nil,
                traceSamplingRate: Float? = nil,
                ttidTraceEnabled: Bool? = nil,
                launchSamplingRate: Float? = nil,
                analyticsSamplingRate: Float? = nil,
                memoryUsageInterval: Int? = nil,
                memoryUsageSessionSamplingRate: Float? = nil,
                httpSamplingRate: Float? = nil,
                httpDisableEventForUrls: [String]? = nil,
                httpTrackRequestForUrls: [String]? = nil,
                httpTrackResponseForUrls: [String]? = nil,
                httpBlockedHeaders: [String]? = nil,
                screenshotMaskLevel: ScreenshotMaskLevel? = nil,
                logAutocollectEnabled: Bool? = nil,
                logMinSeverity: LogSeverity? = nil,
                logIgnorePatterns: [String]? = nil) {
        let defaults = BaseDynamicConfig()
        let errorFatalTakeScreenshot: Bool = errorFatalTakeScreenshot ?? defaults.errorFatalTakeScreenshot
        let errorFatalReplayEnabled: Bool = errorFatalReplayEnabled ?? defaults.errorFatalReplayEnabled
        let errorUnhandledReplayEnabled: Bool = errorUnhandledReplayEnabled ?? defaults.errorUnhandledReplayEnabled
        let errorHandledReplayEnabled: Bool = errorHandledReplayEnabled ?? defaults.errorHandledReplayEnabled
        let errorReplayDurationSeconds: Number = errorReplayDuration.map(Number.init) ?? defaults.errorReplayDurationSeconds
        let errorFatalSamplingRate: Float = errorFatalSamplingRate ?? defaults.errorFatalSamplingRate
        let errorUnhandledSamplingRate: Float = errorUnhandledSamplingRate ?? defaults.errorUnhandledSamplingRate
        let errorHandledSamplingRate: Float = errorHandledSamplingRate ?? defaults.errorHandledSamplingRate
        let appHangThresholdMillis: Number = appHangThresholdMillis.map(Number.init) ?? defaults.appHangThresholdMillis
        let appHangTimelineDurationSeconds: Number = appHangTimelineDuration.map(Number.init) ?? defaults.appHangTimelineDurationSeconds
        let appHangSamplingRate: Float = appHangSamplingRate ?? defaults.appHangSamplingRate
        let appHangReplayEnabled: Bool = appHangReplayEnabled ?? defaults.appHangReplayEnabled
        let bugReportTimelineDurationSeconds: Number = bugReportTimelineDuration.map(Number.init) ?? defaults.bugReportTimelineDurationSeconds
        let traceSamplingRate: Float = traceSamplingRate ?? defaults.traceSamplingRate
        let ttidTraceEnabled: Bool = ttidTraceEnabled ?? defaults.ttidTraceEnabled
        let launchSamplingRate: Float = launchSamplingRate ?? defaults.launchSamplingRate
        let analyticsSamplingRate: Float = analyticsSamplingRate ?? defaults.analyticsSamplingRate
        let memoryUsageInterval: Number = memoryUsageInterval.map(Number.init) ?? defaults.memoryUsageInterval
        let memoryUsageSessionSamplingRate: Float = memoryUsageSessionSamplingRate ?? defaults.memoryUsageSessionSamplingRate
        let httpSamplingRate: Float = httpSamplingRate ?? defaults.httpSamplingRate
        let httpDisableEventForUrls: [String] = httpDisableEventForUrls ?? defaults.httpDisableEventForUrls
        let httpTrackRequestForUrls: [String] = httpTrackRequestForUrls ?? defaults.httpTrackRequestForUrls
        let httpTrackResponseForUrls: [String] = httpTrackResponseForUrls ?? defaults.httpTrackResponseForUrls
        let httpBlockedHeaders: [String] = httpBlockedHeaders ?? defaults.httpBlockedHeaders
        let screenshotMaskLevel: ScreenshotMaskLevel = screenshotMaskLevel ?? defaults.screenshotMaskLevel
        let logAutocollectEnabled: Bool = logAutocollectEnabled ?? defaults.logAutocollectEnabled
        let logMinSeverity: Int = logMinSeverity?.severityNumber ?? defaults.logMinSeverity
        let logIgnorePatterns: [String] = logIgnorePatterns ?? defaults.logIgnorePatterns
        self.dynamicConfig = BaseDynamicConfig(
            errorReplayDurationSeconds: errorReplayDurationSeconds,
            bugReportTimelineDurationSeconds: bugReportTimelineDurationSeconds,
            traceSamplingRate: traceSamplingRate,
            ttidTraceEnabled: ttidTraceEnabled,
            analyticsSamplingRate: analyticsSamplingRate,
            screenshotMaskLevel: screenshotMaskLevel,
            logAutocollectEnabled: logAutocollectEnabled,
            logMinSeverity: logMinSeverity,
            logIgnorePatterns: logIgnorePatterns,
            memoryUsageInterval: memoryUsageInterval,
            memoryUsageSessionSamplingRate: memoryUsageSessionSamplingRate,
            errorFatalTakeScreenshot: errorFatalTakeScreenshot,
            errorFatalReplayEnabled: errorFatalReplayEnabled,
            errorUnhandledReplayEnabled: errorUnhandledReplayEnabled,
            errorHandledReplayEnabled: errorHandledReplayEnabled,
            errorFatalSamplingRate: errorFatalSamplingRate,
            errorUnhandledSamplingRate: errorUnhandledSamplingRate,
            errorHandledSamplingRate: errorHandledSamplingRate,
            appHangThresholdMillis: appHangThresholdMillis,
            appHangTimelineDurationSeconds: appHangTimelineDurationSeconds,
            appHangSamplingRate: appHangSamplingRate,
            appHangReplayEnabled: appHangReplayEnabled,
            launchSamplingRate: launchSamplingRate,
            httpSamplingRate: httpSamplingRate,
            httpDisableEventForUrls: httpDisableEventForUrls,
            httpTrackRequestForUrls: httpTrackRequestForUrls,
            httpTrackResponseForUrls: httpTrackResponseForUrls,
            httpBlockedHeaders: httpBlockedHeaders
        )
        self.enableLogging = enableLogging ?? DefaultConfig.enableLogging
        self.autoStart = autoStart ?? DefaultConfig.autoStart
        self.enableFullCollectionMode = enableFullCollectionMode ?? DefaultConfig.enableFullCollectionMode
        self.requestHeadersProvider = requestHeadersProvider
        self.enableDiagnosticMode = enableDiagnosticMode ?? DefaultConfig.enableDiagnosticMode
        self.enableDiagnosticModeGesture = enableDiagnosticModeGesture ?? DefaultConfig.enableDiagnosticModeGesture
        self.enableCppThrowSiteCapture = enableCppThrowSiteCapture ?? DefaultConfig.enableCppThrowSiteCapture

        let minDiskUsage: Number = 20
        let maxDiskUsage: Number = 1500

        if let provided = maxDiskUsageInMb {
            if provided < minDiskUsage {
                debugPrint("maxDiskUsageInMb too low (\(provided)MB). Clamping to \(minDiskUsage)MB.")
                self.maxDiskUsageInMb = minDiskUsage
            } else if provided > maxDiskUsage {
                debugPrint("maxDiskUsageInMb too high (\(provided)MB). Clamping to \(maxDiskUsage)MB.")
                self.maxDiskUsageInMb = maxDiskUsage
            } else {
                self.maxDiskUsageInMb = Number(provided)
            }
        } else {
            self.maxDiskUsageInMb = DefaultConfig.maxDiskUsageInMb
        }
    }

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
    ///   - autoStart: Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
    ///   - requestHeadersProvider: Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API.
    ///   - maxDiskUsageInMb: Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use. Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`.
    ///   - enableFullCollectionMode: Override all sampling configs and track all events and traces. **Note** that enabling
    ///     this flag can significantly increase the cost and should typically only be enabled for debug mode.
    ///   - enableDiagnosticMode: Enables diagnostic mode which writes all SDK logs to a file. The log file can be attached when reporting a bug to help with debugging SDK issues. Defaults to `false`.
    ///   - enableDiagnosticModeGesture: Enable double finger double tap gesture to export SDK logs via share sheet. This
    ///     functionality is only available if `enableDiagnosticMode` is set to `true`. Defaults to `false`.
    @objc public convenience init(enableLogging: Bool,
                                  autoStart: Bool,
                                  requestHeadersProvider: MsrRequestHeadersProvider?,
                                  maxDiskUsageInMb: NSNumber?,
                                  enableFullCollectionMode: Bool,
                                  enableDiagnosticMode: Bool,
                                  enableDiagnosticModeGesture: Bool) {
        self.init(enableLogging: enableLogging,
                  autoStart: autoStart,
                  requestHeadersProvider: requestHeadersProvider,
                  maxDiskUsageInMb: maxDiskUsageInMb?.intValue,
                  enableFullCollectionMode: enableFullCollectionMode,
                  enableDiagnosticMode: enableDiagnosticMode,
                  enableDiagnosticModeGesture: enableDiagnosticModeGesture)

    }

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// Same as the initializer above, plus `enableCppThrowSiteCapture`. See its documentation on `BaseMeasureConfig`.
    @objc public convenience init(enableLogging: Bool,
                                  autoStart: Bool,
                                  requestHeadersProvider: MsrRequestHeadersProvider?,
                                  maxDiskUsageInMb: NSNumber?,
                                  enableFullCollectionMode: Bool,
                                  enableDiagnosticMode: Bool,
                                  enableDiagnosticModeGesture: Bool,
                                  enableCppThrowSiteCapture: Bool) {
        self.init(enableLogging: enableLogging,
                  autoStart: autoStart,
                  requestHeadersProvider: requestHeadersProvider,
                  maxDiskUsageInMb: maxDiskUsageInMb?.intValue,
                  enableFullCollectionMode: enableFullCollectionMode,
                  enableDiagnosticMode: enableDiagnosticMode,
                  enableDiagnosticModeGesture: enableDiagnosticModeGesture,
                  enableCppThrowSiteCapture: enableCppThrowSiteCapture)
    }

    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        enableLogging = try container.decodeIfPresent(Bool.self, forKey: .enableLogging) ?? DefaultConfig.enableLogging
        autoStart = try container.decodeIfPresent(Bool.self, forKey: .autoStart) ?? DefaultConfig.autoStart
        enableFullCollectionMode = try container.decodeIfPresent(Bool.self, forKey: .enableFullCollectionMode) ?? DefaultConfig.enableFullCollectionMode
        requestHeadersProvider = nil // requestHeadersProvider is not encodable
        enableDiagnosticMode = try container.decodeIfPresent(Bool.self, forKey: .enableDiagnosticMode) ?? DefaultConfig.enableDiagnosticMode
        enableDiagnosticModeGesture = try container.decodeIfPresent(Bool.self, forKey: .enableDiagnosticModeGesture) ?? DefaultConfig.enableDiagnosticModeGesture
        enableCppThrowSiteCapture = try container.decodeIfPresent(Bool.self, forKey: .enableCppThrowSiteCapture) ?? DefaultConfig.enableCppThrowSiteCapture
        dynamicConfig = BaseDynamicConfig()

        let minDiskUsage: Number = 20
        let maxDiskUsage: Number = 1500
        if let provided = try container.decodeIfPresent(Int.self, forKey: .maxDiskUsageInMb) {
            if provided < minDiskUsage {
                debugPrint("maxDiskUsageInMb too low (\(provided)MB). Clamping to \(minDiskUsage)MB.")
                maxDiskUsageInMb = minDiskUsage
            } else if provided > maxDiskUsage {
                debugPrint("maxDiskUsageInMb too high (\(provided)MB). Clamping to \(maxDiskUsage)MB.")
                maxDiskUsageInMb = maxDiskUsage
            } else {
                maxDiskUsageInMb = Number(provided)
            }
        } else {
            maxDiskUsageInMb = DefaultConfig.maxDiskUsageInMb
        }

        super.init()
    }

    private enum CodingKeys: String, CodingKey {
        case enableLogging
        case autoStart
        // requestHeadersProvider is not encodable
        case maxDiskUsageInMb
        case enableFullCollectionMode
        case enableDiagnosticMode
        case enableDiagnosticModeGesture
        case enableCppThrowSiteCapture
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(enableLogging, forKey: .enableLogging)
        try container.encode(autoStart, forKey: .autoStart)
        try container.encode(maxDiskUsageInMb, forKey: .maxDiskUsageInMb)
        try container.encode(enableFullCollectionMode, forKey: .enableFullCollectionMode)
        try container.encode(enableDiagnosticMode, forKey: .enableDiagnosticMode)
        try container.encode(enableDiagnosticModeGesture, forKey: .enableDiagnosticModeGesture)
        try container.encode(enableCppThrowSiteCapture, forKey: .enableCppThrowSiteCapture)
    }
}
