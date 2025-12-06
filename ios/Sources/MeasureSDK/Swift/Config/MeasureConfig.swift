//
//  MeasureConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Configuration for the Measure SDK. See `MeasureConfig` for details.
protocol MeasureConfig {
    var enableDebugMode: Bool { get }
    var samplingRateForErrorFreeSessions: Float { get }
    var traceSamplingRate: Float { get }
    var trackHttpHeaders: Bool { get }
    var trackHttpBody: Bool { get }
    var httpHeadersBlocklist: [String] { get }
    var httpUrlBlocklist: [String] { get }
    var httpUrlAllowlist: [String] { get }
    var autoStart: Bool { get }
    var screenshotMaskLevel: ScreenshotMaskLevel { get }
    var requestHeadersProvider: MsrRequestHeadersProvider? { get }
    var maxDiskUsageInMb: Int { get }
    var coldLaunchSamplingRate: Float { get }
    var warmLaunchSamplingRate: Float { get }
    var hotLaunchSamplingRate: Float { get }
    var journeySamplingRate: Float { get }
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
@objc public final class BaseMeasureConfig: NSObject, MeasureConfig, Codable {
    /// Whether to enable SDK in initialized for a debug build.
    /// When `enableDebugMode` is enabled the data is exported out to the server every 30 seconds instead of the default 5 minitues.
    /// Enabling `enableDebugMode` will also show Measure SDK logs when debugger is attached.
    ///
    /// Defaults to `false`.
    let enableDebugMode: Bool

    /// The sampling rate for non-crashed sessions. Must be between 0.0 and 1.0. Defaults to 0.
    let samplingRateForErrorFreeSessions: Float

    /// The sampling rate for traces. Must be between 0.0 and 1.0. Defaults to 0.0001.
    /// For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    let traceSamplingRate: Float

    /// The sampling rate for cold launch times. Must be between 0.0 and 1.0. Defaults to 0.01.
    let coldLaunchSamplingRate: Float

    /// The sampling rate for warm launch times. Must be between 0.0 and 1.0. Defaults to 0.01.
    let warmLaunchSamplingRate: Float

    /// The sampling rate for hot launch times. Must be between 0.0 and 1.0. Defaults to 0.01.
    let hotLaunchSamplingRate: Float

    /// Configures sampling rate for sessions that track "user journeys". This feature shows traffic of users across different screens of the app.
    /// When set to 0, the journey will only be generated from crashed sessions or sessions collected using `samplingRateForErrorFreeSessions`
    ///
    /// Defaults to 0.
    ///
    /// If a value of 0.1 is set, then 10% of the sessions will contain events required to build the journey which includes screen view, lifecycle view controller.
    let journeySamplingRate: Float

    /// Set to false to delay starting the SDK, by default initializing the SDK also starts tracking. Defaults to true.
    let autoStart: Bool

    /// Whether to capture http headers of a network request and response. Defaults to `false`.
    let trackHttpHeaders: Bool

    /// Whether to capture http body of a network request and response. Defaults to `false`.
    let trackHttpBody: Bool

    /// List of HTTP headers to not collect with the `http` event for both request and response.
    /// Defaults to an empty list. The following headers are always excluded:
    /// - * Authorization
    /// - * Cookie
    /// - * Set-Cookie
    /// - * Proxy-Authorization
    /// - * WWW-Authenticate
    /// - * X-Api-Key
    ///
    let httpHeadersBlocklist: [String]

    /// Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not want to collect data for certain endpoints.
    ///
    /// Note that this config is ignored if [httpUrlAllowlist] is set.
    ///
    /// You can:
    /// - Disables a domain, eg. example.com
    /// - Disable a subdomain, eg. api.example.com
    /// - Disable a particular path, eg. example.com/order
    ///
    let httpUrlBlocklist: [String]

    /// Allows enabling collection of `http` events for only certain URLs. This is useful to setup if you do not want to collect data for all endpoints except for a few.
    ///
    /// You can:
    /// - Disables a domain, eg. example.com
    /// - Disable a subdomain, eg. api.example.com
    /// - Disable a particular path, eg. example.com/order
    ///
    let httpUrlAllowlist: [String]

    /// Allows changing the masking level of screenshots to prevent sensitive information from leaking.
    /// Defaults to [ScreenshotMaskLevel.allTextAndMedia].
    let screenshotMaskLevel: ScreenshotMaskLevel

    /// Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API.
    ///
    /// This is useful only for self-hosted clients who may require additional headers for requests in their infrastructure.
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
    let maxDiskUsageInMb: Int

    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        enableDebugMode = try container.decodeIfPresent(Bool.self, forKey: .enableDebugMode) ?? DefaultConfig.enableDebugMode
        autoStart = try container.decodeIfPresent(Bool.self, forKey: .autoStart) ?? DefaultConfig.autoStart
        trackHttpHeaders = try container.decodeIfPresent(Bool.self, forKey: .trackHttpHeaders) ?? DefaultConfig.trackHttpHeaders
        trackHttpBody = try container.decodeIfPresent(Bool.self, forKey: .trackHttpBody) ?? DefaultConfig.trackHttpBody
        httpHeadersBlocklist = try container.decodeIfPresent([String].self, forKey: .httpHeadersBlocklist) ?? DefaultConfig.httpHeadersBlocklist
        httpUrlBlocklist = try container.decodeIfPresent([String].self, forKey: .httpUrlBlocklist) ?? DefaultConfig.httpUrlBlocklist
        httpUrlAllowlist = try container.decodeIfPresent([String].self, forKey: .httpUrlAllowlist) ?? DefaultConfig.httpUrlAllowlist
        screenshotMaskLevel = try container.decodeIfPresent(ScreenshotMaskLevel.self, forKey: .screenshotMaskLevel) ?? DefaultConfig.screenshotMaskLevel
        requestHeadersProvider = nil // requestHeadersProvider is not encodable

        let decodedSessionSampling = try container.decodeIfPresent(Float.self, forKey: .samplingRateForErrorFreeSessions)
        let decodedTraceSampling = try container.decodeIfPresent(Float.self, forKey: .traceSamplingRate)
        let decodedColdLaunchSampling = try container.decodeIfPresent(Float.self, forKey: .coldLaunchSamplingRate)
        let decodedWarmLaunchSampling = try container.decodeIfPresent(Float.self, forKey: .warmLaunchSamplingRate)
        let decodedHotLaunchSampling = try container.decodeIfPresent(Float.self, forKey: .hotLaunchSamplingRate)
        let decodedJourneySampling = try container.decodeIfPresent(Float.self, forKey: .journeySamplingRate)

        let minDiskUsage = 20
        let maxDiskUsage = 1500
        if let provided = try container.decodeIfPresent(Int.self, forKey: .maxDiskUsageInMb) {
            if provided < minDiskUsage {
                debugPrint("maxDiskUsageInMb too low (\(provided)MB). Clamping to \(minDiskUsage)MB.")
                maxDiskUsageInMb = minDiskUsage
            } else if provided > maxDiskUsage {
                debugPrint("maxDiskUsageInMb too high (\(provided)MB). Clamping to \(maxDiskUsage)MB.")
                maxDiskUsageInMb = maxDiskUsage
            } else {
                maxDiskUsageInMb = provided
            }
        } else {
            maxDiskUsageInMb = DefaultConfig.maxEstimatedDiskUsageInMb
        }

        samplingRateForErrorFreeSessions = Self.validated(decodedSessionSampling,
                                                          default: DefaultConfig.sessionSamplingRate,
                                                          label: "Session sampling rate")
        traceSamplingRate = Self.validated(decodedTraceSampling,
                                           default: DefaultConfig.traceSamplingRate,
                                           label: "Trace sampling rate")
        coldLaunchSamplingRate = Self.validated(decodedColdLaunchSampling,
                                                default: DefaultConfig.coldLaunchSamplingRate,
                                                label: "Cold launch sampling rate")
        warmLaunchSamplingRate = Self.validated(decodedWarmLaunchSampling,
                                                default: DefaultConfig.warmLaunchSamplingRate,
                                                label: "Warm launch sampling rate")
        hotLaunchSamplingRate = Self.validated(decodedHotLaunchSampling,
                                               default: DefaultConfig.hotLaunchSamplingRate,
                                               label: "Hot launch sampling rate")
        journeySamplingRate = Self.validated(decodedJourneySampling,
                                             default: DefaultConfig.journeySamplingRate,
                                             label: "Journey sampling rate")

        super.init()
    }

    private enum CodingKeys: String, CodingKey {
        case enableDebugMode
        case samplingRateForErrorFreeSessions
        case traceSamplingRate
        case autoStart
        case trackHttpHeaders
        case trackHttpBody
        case httpHeadersBlocklist
        case httpUrlBlocklist
        case httpUrlAllowlist
        case screenshotMaskLevel
        // requestHeadersProvider is not encodable
        case maxDiskUsageInMb
        case coldLaunchSamplingRate
        case warmLaunchSamplingRate
        case hotLaunchSamplingRate
        case journeySamplingRate
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(enableDebugMode, forKey: .enableDebugMode)
        try container.encode(samplingRateForErrorFreeSessions, forKey: .samplingRateForErrorFreeSessions)
        try container.encode(traceSamplingRate, forKey: .traceSamplingRate)
        try container.encode(autoStart, forKey: .autoStart)
        try container.encode(trackHttpHeaders, forKey: .trackHttpHeaders)
        try container.encode(trackHttpBody, forKey: .trackHttpBody)
        try container.encode(httpHeadersBlocklist, forKey: .httpHeadersBlocklist)
        try container.encode(httpUrlBlocklist, forKey: .httpUrlBlocklist)
        try container.encode(httpUrlAllowlist, forKey: .httpUrlAllowlist)
        try container.encode(screenshotMaskLevel, forKey: .screenshotMaskLevel)
        try container.encode(maxDiskUsageInMb, forKey: .maxDiskUsageInMb)
        try container.encode(coldLaunchSamplingRate, forKey: .coldLaunchSamplingRate)
        try container.encode(warmLaunchSamplingRate, forKey: .warmLaunchSamplingRate)
        try container.encode(hotLaunchSamplingRate, forKey: .hotLaunchSamplingRate)
        try container.encode(journeySamplingRate, forKey: .journeySamplingRate)
    }

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableDebugMode: Whether to enable SDK in initialized for a debug build.
    ///     When `enableDebugMode` is enabled the data is exported out to the server every 30 seconds instead of the default 5 minitues.
    ///     Enabling `enableDebugMode` will also show Measure SDK logs when debugger is attached.
    ///     Defaults to `false`.
    ///   - samplingRateForErrorFreeSessions: Sampling rate for sessions without a crash. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.5` will export only 50% of the non-crashed sessions, and a value of `0` will disable sending non-crashed sessions to the server.
    ///   - traceSamplingRate: Sampling rate for traces. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    ///   - coldLaunchSamplingRate: Sampling rate for cold launch times. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    ///   - warmLaunchSamplingRate: Sampling rate for warm launch times. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    ///   - hotLaunchSamplingRate: Sampling rate for hot launch times. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    ///   - journeySamplingRate:Configures sampling rate for sessions that track "user journeys". This feature shows traffic of users across different screens of the app.
    ///   When set to 0, the journey will only be generated from crashed sessions or sessions collected using `samplingRateForErrorFreeSessions`. Defaults to 0.
    ///   - trackHttpHeaders: Whether to capture http headers of a network request and response. Defaults to `false`.
    ///   - trackHttpBody:Whether to capture http body of a network request and response. Defaults to `false`.
    ///   - httpHeadersBlocklist:List of HTTP headers to not collect with the `http` event for both request and response. Defaults to an empty list. The following headers are always excluded:
    ///       - Authorization
    ///       - Cookie
    ///       - Set-Cookie
    ///       - Proxy-Authorization
    ///       - WWW-Authenticate
    ///       - X-Api-Key
    ///   - httpUrlBlocklist: Allows disabling collection of `http` events for certain URLs.
    ///   This is useful to setup if you do not want to collect data for certain endpoints.Note that this config is ignored if [httpUrlAllowlist] is set. You can:
    ///       - Disables a domain, eg. example.com
    ///       - Disable a subdomain, eg. api.example.com
    ///       - Disable a particular path, eg. example.com/order
    ///   - httpUrlAllowlist: Allows enabling collection of `http` events for only certain URLs. This is useful to setup if you do not want to collect data for all endpoints except for a few. You can:
    ///       - Disables a domain, eg. example.com
    ///       - Disable a subdomain, eg. api.example.com
    ///       - Disable a particular path, eg. example.com/order
    ///   - autoStart: Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
    ///   - screenshotMaskLevel: Allows changing the masking level of screenshots to prevent sensitive information from leaking. Defaults to [ScreenshotMaskLevel.allTextAndMedia].
    ///   - requestHeadersProvider: Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API.
    ///   - maxDiskUsageInMb: Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use. Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`.
    public init(enableDebugMode: Bool? = nil,
                samplingRateForErrorFreeSessions: Float? = nil,
                traceSamplingRate: Float? = nil,
                coldLaunchSamplingRate: Float? = nil,
                warmLaunchSamplingRate: Float? = nil,
                hotLaunchSamplingRate: Float? = nil,
                journeySamplingRate: Float? = nil,
                trackHttpHeaders: Bool? = nil,
                trackHttpBody: Bool? = nil,
                httpHeadersBlocklist: [String]? = nil,
                httpUrlBlocklist: [String]? = nil,
                httpUrlAllowlist: [String]? = nil,
                autoStart: Bool? = nil,
                screenshotMaskLevel: ScreenshotMaskLevel? = nil,
                requestHeadersProvider: MsrRequestHeadersProvider? = nil,
                maxDiskUsageInMb: Int? = nil) {
        self.enableDebugMode = enableDebugMode ?? DefaultConfig.enableDebugMode
        self.trackHttpHeaders = trackHttpHeaders ?? DefaultConfig.trackHttpHeaders
        self.trackHttpBody = trackHttpBody ?? DefaultConfig.trackHttpBody
        self.httpHeadersBlocklist = httpHeadersBlocklist ?? DefaultConfig.httpHeadersBlocklist
        self.httpUrlBlocklist = httpUrlBlocklist ?? DefaultConfig.httpUrlBlocklist
        self.httpUrlAllowlist = httpUrlAllowlist ?? DefaultConfig.httpUrlAllowlist
        self.autoStart = autoStart ?? DefaultConfig.autoStart
        self.screenshotMaskLevel = screenshotMaskLevel ?? DefaultConfig.screenshotMaskLevel
        self.requestHeadersProvider = requestHeadersProvider

        let minDiskUsage = 20
        let maxDiskUsage = 1500

        if let provided = maxDiskUsageInMb {
            if provided < minDiskUsage {
                debugPrint("maxDiskUsageInMb too low (\(provided)MB). Clamping to \(minDiskUsage)MB.")
                self.maxDiskUsageInMb = minDiskUsage
            } else if provided > maxDiskUsage {
                debugPrint("maxDiskUsageInMb too high (\(provided)MB). Clamping to \(maxDiskUsage)MB.")
                self.maxDiskUsageInMb = maxDiskUsage
            } else {
                self.maxDiskUsageInMb = provided
            }
        } else {
            self.maxDiskUsageInMb = DefaultConfig.maxEstimatedDiskUsageInMb
        }

        self.samplingRateForErrorFreeSessions = Self.validated(samplingRateForErrorFreeSessions,
                                                               default: DefaultConfig.sessionSamplingRate,
                                                               label: "Session sampling rate")
        self.traceSamplingRate = Self.validated(traceSamplingRate,
                                                default: DefaultConfig.traceSamplingRate,
                                                label: "Trace sampling rate")
        
        self.coldLaunchSamplingRate = Self.validated(coldLaunchSamplingRate,
                                                     default: DefaultConfig.coldLaunchSamplingRate,
                                                     label: "Cold launch sampling rate")
        
        self.warmLaunchSamplingRate = Self.validated(warmLaunchSamplingRate,
                                                     default: DefaultConfig.warmLaunchSamplingRate,
                                                     label: "Warm launch sampling rate")
        
        self.hotLaunchSamplingRate = Self.validated(hotLaunchSamplingRate,
                                                    default: DefaultConfig.hotLaunchSamplingRate,
                                                    label: "Hot launch sampling rate")
        self.journeySamplingRate = Self.validated(journeySamplingRate,
                                                  default: DefaultConfig.journeySamplingRate,
                                                  label: "Journey sampling rate")
    }

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableDebugMode: Whether to enable SDK in initialized for a debug build.
    ///     When `enableDebugMode` is enabled the data is exported out to the server every 30 seconds instead of the default 5 minitues.
    ///     Enabling `enableDebugMode` will also show Measure SDK logs when debugger is attached.
    ///     Defaults to `false`.
    ///   - samplingRateForErrorFreeSessions: Sampling rate for sessions without a crash. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.5` will export only 50% of the non-crashed sessions, and a value of `0` will disable sending non-crashed sessions to the server.
    ///   - traceSamplingRate: Sampling rate for traces. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    ///   - coldLaunchSamplingRate: Sampling rate for cold launch times. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    ///   - warmLaunchSamplingRate: Sampling rate for warm launch times. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    ///   - hotLaunchSamplingRate: Sampling rate for hot launch times. The sampling rate is a value between 0 and 1.
    ///   - journeySamplingRate:Configures sampling rate for sessions that track "user journeys". This feature shows traffic of users across different screens of the app.
    ///   When set to 0, the journey will only be generated from crashed sessions or sessions collected using `samplingRateForErrorFreeSessions`. Defaults to 0.
    ///   For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    ///   - trackHttpHeaders: Whether to capture http headers of a network request and response. Defaults to `false`.
    ///   - trackHttpBody:Whether to capture http body of a network request and response. Defaults to `false`.
    ///   - httpHeadersBlocklist:List of HTTP headers to not collect with the `http` event for both request and response. Defaults to an empty list. The following headers are always excluded:
    ///       - Authorization
    ///       - Cookie
    ///       - Set-Cookie
    ///       - Proxy-Authorization
    ///       - WWW-Authenticate
    ///       - X-Api-Key
    ///   - httpUrlBlocklist: Allows disabling collection of `http` events for certain URLs.
    ///   This is useful to setup if you do not want to collect data for certain endpoints.Note that this config is ignored if [httpUrlAllowlist] is set. You can:
    ///       - Disables a domain, eg. example.com
    ///       - Disable a subdomain, eg. api.example.com
    ///       - Disable a particular path, eg. example.com/order
    ///   - httpUrlAllowlist: Allows enabling collection of `http` events for only certain URLs. This is useful to setup if you do not want to collect data for all endpoints except for a few. You can:
    ///       - Disables a domain, eg. example.com
    ///       - Disable a subdomain, eg. api.example.com
    ///       - Disable a particular path, eg. example.com/order
    ///   - autoStart: Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
    ///   - screenshotMaskLevel: Allows changing the masking level of screenshots to prevent sensitive information from leaking. Defaults to [ScreenshotMaskLevel.allTextAndMedia].
    ///   - requestHeadersProvider: Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API.
    ///   - maxDiskUsageInMb: Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use. Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`.
    @objc public convenience init(enableDebugMode: Bool,
                                  samplingRateForErrorFreeSessions: Float,
                                  traceSamplingRate: Float,
                                  coldLaunchSamplingRate: Float,
                                  warmLaunchSamplingRate: Float,
                                  hotLaunchSamplingRate: Float,
                                  journeySamplingRate: Float,
                                  trackHttpHeaders: Bool,
                                  trackHttpBody: Bool,
                                  httpHeadersBlocklist: [String],
                                  httpUrlBlocklist: [String],
                                  httpUrlAllowlist: [String],
                                  autoStart: Bool,
                                  screenshotMaskLevel: ScreenshotMaskLevelObjc,
                                  requestHeadersProvider: MsrRequestHeadersProvider?,
                                  maxDiskUsageInMb: NSNumber?) {
        self.init(enableDebugMode: enableDebugMode,
                  samplingRateForErrorFreeSessions: samplingRateForErrorFreeSessions,
                  traceSamplingRate: traceSamplingRate,
                  coldLaunchSamplingRate: coldLaunchSamplingRate,
                  warmLaunchSamplingRate: warmLaunchSamplingRate,
                  hotLaunchSamplingRate: hotLaunchSamplingRate,
                  journeySamplingRate: journeySamplingRate,
                  trackHttpHeaders: trackHttpHeaders,
                  trackHttpBody: trackHttpBody,
                  httpHeadersBlocklist: httpHeadersBlocklist,
                  httpUrlBlocklist: httpUrlBlocklist,
                  httpUrlAllowlist: httpUrlAllowlist,
                  autoStart: autoStart,
                  screenshotMaskLevel: screenshotMaskLevel.toSwiftValue(),
                  requestHeadersProvider: requestHeadersProvider,
                  maxDiskUsageInMb: maxDiskUsageInMb?.intValue)
    }

    private static func validated(_ value: Float?,
                                  default def: Float,
                                  label: String) -> Float {
        if let value, !(0.0...1.0).contains(value) {
            debugPrint("\(label) must be between 0.0 and 1.0. Setting default value.")
            return def
        }
        return value ?? def
    }
}
