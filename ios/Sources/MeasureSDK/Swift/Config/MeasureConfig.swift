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
    var trackViewControllerLoadTime: Bool { get }
    var screenshotMaskLevel: ScreenshotMaskLevel { get }
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
@objc public final class BaseMeasureConfig: NSObject, MeasureConfig, Codable {
    /// Whether to enable internal SDK logging. Defaults to `false`.
    let enableLogging: Bool

    /// The sampling rate for non-crashed sessions. Must be between 0.0 and 1.0. Defaults to 1.0.
    let samplingRateForErrorFreeSessions: Float

    /// The sampling rate for traces. Must be between 0.0 and 1.0. Defaults to 0.1.
    /// For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
    let traceSamplingRate: Float

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

    /// Enables or disables automatic collection of ViewController load time. Defaults to `true`.
    ///
    /// ViewController load time measures the time between when the ViewController's view is loaded
    /// and the first frame is drawn on the screen. This is also known as **Time to First Frame (TTF)**
    /// or **Time to Initial Display (TTID)**.
    ///
    /// A large TTID value means users are waiting too long before any content appears on screen during
    /// app navigation.
    ///
    /// Each ViewController load time is captured as a `Span` with the name
    /// `VC TTID <class name>`. For example, for a class
    /// `MainViewController`, the span name would be:
    /// `VC TTID MainViewController`.
    ///
    /// Set to `false` to disable this tracking.
    let trackViewControllerLoadTime: Bool

    /// Allows changing the masking level of screenshots to prevent sensitive information from leaking.
    /// Defaults to [ScreenshotMaskLevel.allTextAndMedia].
    let screenshotMaskLevel: ScreenshotMaskLevel

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
         trackViewControllerLoadTime = try container.decodeIfPresent(Bool.self, forKey: .trackViewControllerLoadTime) ?? DefaultConfig.trackViewControllerLoadTime
         screenshotMaskLevel = try container.decodeIfPresent(ScreenshotMaskLevel.self, forKey: .screenshotMaskLevel) ?? DefaultConfig.screenshotMaskLevel

         super.init()
     }

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
    ///   - samplingRateForErrorFreeSessions: Sampling rate for sessions without a crash. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.5` will export only 50% of the non-crashed sessions, and a value of `0` will disable sending non-crashed sessions to the server.
    ///   - traceSamplingRate: Sampling rate for traces. The sampling rate is a value between 0 and 1.
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
    public init(enableLogging: Bool? = nil,
                samplingRateForErrorFreeSessions: Float? = nil,
                traceSamplingRate: Float? = nil,
                trackHttpHeaders: Bool? = nil,
                trackHttpBody: Bool? = nil,
                httpHeadersBlocklist: [String]? = nil,
                httpUrlBlocklist: [String]? = nil,
                httpUrlAllowlist: [String]? = nil,
                autoStart: Bool? = nil,
                trackViewControllerLoadTime: Bool? = nil,
                screenshotMaskLevel: ScreenshotMaskLevel? = nil) {
        self.enableLogging = enableLogging ?? DefaultConfig.enableLogging
        self.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions ?? DefaultConfig.sessionSamplingRate
        self.traceSamplingRate = traceSamplingRate ?? DefaultConfig.traceSamplingRate
        self.trackHttpHeaders = trackHttpHeaders ?? DefaultConfig.trackHttpHeaders
        self.trackHttpBody = trackHttpBody ?? DefaultConfig.trackHttpBody
        self.httpHeadersBlocklist = httpHeadersBlocklist ?? DefaultConfig.httpHeadersBlocklist
        self.httpUrlBlocklist = httpUrlBlocklist ?? DefaultConfig.httpUrlBlocklist
        self.httpUrlAllowlist = httpUrlAllowlist ?? DefaultConfig.httpUrlAllowlist
        self.autoStart = autoStart ?? DefaultConfig.autoStart
        self.trackViewControllerLoadTime = trackViewControllerLoadTime ?? DefaultConfig.trackViewControllerLoadTime
        self.screenshotMaskLevel = screenshotMaskLevel ?? DefaultConfig.screenshotMaskLevel

        if !(0.0...1.0).contains(self.samplingRateForErrorFreeSessions) {
            debugPrint("Session sampling rate must be between 0.0 and 1.0")
        }

        if !(0.0...1.0).contains(self.traceSamplingRate) {
            debugPrint("Trace sampling rate must be between 0.0 and 1.0")
        }
    }
}
