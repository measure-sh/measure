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
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
@objc public final class BaseMeasureConfig: NSObject, MeasureConfig, Codable {
    /// Whether to enable internal SDK logging. Defaults to `false`.
    let enableLogging: Bool

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

        enableLogging = try container.decodeIfPresent(Bool.self, forKey: .enableLogging) ?? DefaultConfig.enableLogging
        samplingRateForErrorFreeSessions = try container.decodeIfPresent(Float.self, forKey: .samplingRateForErrorFreeSessions) ?? DefaultConfig.sessionSamplingRate
        traceSamplingRate = try container.decodeIfPresent(Float.self, forKey: .traceSamplingRate) ?? DefaultConfig.traceSamplingRate
        autoStart = try container.decodeIfPresent(Bool.self, forKey: .autoStart) ?? DefaultConfig.autoStart
        trackHttpHeaders = try container.decodeIfPresent(Bool.self, forKey: .trackHttpHeaders) ?? DefaultConfig.trackHttpHeaders
        trackHttpBody = try container.decodeIfPresent(Bool.self, forKey: .trackHttpBody) ?? DefaultConfig.trackHttpBody
        httpHeadersBlocklist = try container.decodeIfPresent([String].self, forKey: .httpHeadersBlocklist) ?? DefaultConfig.httpHeadersBlocklist
        httpUrlBlocklist = try container.decodeIfPresent([String].self, forKey: .httpUrlBlocklist) ?? DefaultConfig.httpUrlBlocklist
        httpUrlAllowlist = try container.decodeIfPresent([String].self, forKey: .httpUrlAllowlist) ?? DefaultConfig.httpUrlAllowlist
        screenshotMaskLevel = try container.decodeIfPresent(ScreenshotMaskLevel.self, forKey: .screenshotMaskLevel) ?? DefaultConfig.screenshotMaskLevel
        requestHeadersProvider = nil // requestHeadersProvider is not encodable
        maxDiskUsageInMb = try container.decodeIfPresent(Int.self, forKey: .maxDiskUsageInMb) ?? DefaultConfig.maxEstimatedDiskUsageInMb
        coldLaunchSamplingRate = try container.decodeIfPresent(Float.self, forKey: .coldLaunchSamplingRate) ?? DefaultConfig.coldLaunchSamplingRate
        warmLaunchSamplingRate = try container.decodeIfPresent(Float.self, forKey: .warmLaunchSamplingRate) ?? DefaultConfig.warmLaunchSamplingRate
        hotLaunchSamplingRate = try container.decodeIfPresent(Float.self, forKey: .hotLaunchSamplingRate) ?? DefaultConfig.hotLaunchSamplingRate

        super.init()
    }

    private enum CodingKeys: String, CodingKey {
        case enableLogging
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
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(enableLogging, forKey: .enableLogging)
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
    }

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
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
    public init(enableLogging: Bool? = nil,
                samplingRateForErrorFreeSessions: Float? = nil,
                traceSamplingRate: Float? = nil,
                coldLaunchSamplingRate: Float? = nil,
                warmLaunchSamplingRate: Float? = nil,
                hotLaunchSamplingRate: Float? = nil,
                trackHttpHeaders: Bool? = nil,
                trackHttpBody: Bool? = nil,
                httpHeadersBlocklist: [String]? = nil,
                httpUrlBlocklist: [String]? = nil,
                httpUrlAllowlist: [String]? = nil,
                autoStart: Bool? = nil,
                screenshotMaskLevel: ScreenshotMaskLevel? = nil,
                requestHeadersProvider: MsrRequestHeadersProvider? = nil,
                maxDiskUsageInMb: Int? = nil) {
        self.enableLogging = enableLogging ?? DefaultConfig.enableLogging
        self.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions ?? DefaultConfig.sessionSamplingRate
        self.traceSamplingRate = traceSamplingRate ?? DefaultConfig.traceSamplingRate
        self.trackHttpHeaders = trackHttpHeaders ?? DefaultConfig.trackHttpHeaders
        self.trackHttpBody = trackHttpBody ?? DefaultConfig.trackHttpBody
        self.httpHeadersBlocklist = httpHeadersBlocklist ?? DefaultConfig.httpHeadersBlocklist
        self.httpUrlBlocklist = httpUrlBlocklist ?? DefaultConfig.httpUrlBlocklist
        self.httpUrlAllowlist = httpUrlAllowlist ?? DefaultConfig.httpUrlAllowlist
        self.autoStart = autoStart ?? DefaultConfig.autoStart
        self.screenshotMaskLevel = screenshotMaskLevel ?? DefaultConfig.screenshotMaskLevel
        self.requestHeadersProvider = requestHeadersProvider
        self.maxDiskUsageInMb = maxDiskUsageInMb ?? DefaultConfig.maxEstimatedDiskUsageInMb
        self.coldLaunchSamplingRate = coldLaunchSamplingRate ?? DefaultConfig.coldLaunchSamplingRate
        self.warmLaunchSamplingRate = warmLaunchSamplingRate ?? DefaultConfig.warmLaunchSamplingRate
        self.hotLaunchSamplingRate = hotLaunchSamplingRate ?? DefaultConfig.hotLaunchSamplingRate

        if !(0.0...1.0).contains(self.samplingRateForErrorFreeSessions) {
            debugPrint("Session sampling rate must be between 0.0 and 1.0")
        }

        if !(0.0...1.0).contains(self.traceSamplingRate) {
            debugPrint("Trace sampling rate must be between 0.0 and 1.0")
        }
    }

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
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
    @objc public convenience init(enableLogging: Bool,
                                  samplingRateForErrorFreeSessions: Float,
                                  traceSamplingRate: Float,
                                  coldLaunchSamplingRate: Float,
                                  warmLaunchSamplingRate: Float,
                                  hotLaunchSamplingRate: Float,
                                  trackHttpHeaders: Bool,
                                  trackHttpBody: Bool,
                                  httpHeadersBlocklist: [String],
                                  httpUrlBlocklist: [String],
                                  httpUrlAllowlist: [String],
                                  autoStart: Bool,
                                  screenshotMaskLevel: ScreenshotMaskLevelObjc,
                                  requestHeadersProvider: MsrRequestHeadersProvider?,
                                  maxDiskUsageInMb: NSNumber?) {
        self.init(enableLogging: enableLogging,
                  samplingRateForErrorFreeSessions: samplingRateForErrorFreeSessions,
                  traceSamplingRate: traceSamplingRate,
                  coldLaunchSamplingRate: coldLaunchSamplingRate,
                  warmLaunchSamplingRate: warmLaunchSamplingRate,
                  hotLaunchSamplingRate: hotLaunchSamplingRate,
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
}
