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
    var trackHttpHeaders: Bool { get }
    var trackHttpBody: Bool { get }
    var httpHeadersBlocklist: [String] { get }
    var httpUrlBlocklist: [String] { get }
    var httpUrlAllowlist: [String] { get }
    var autoStart: Bool { get }
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
@objc public final class BaseMeasureConfig: NSObject, MeasureConfig {
    /// Whether to enable internal SDK logging. Defaults to `false`.
    let enableLogging: Bool

    /// The sampling rate for non-crashed sessions. Must be between 0.0 and 1.0. Defaults to 1.0.
    let samplingRateForErrorFreeSessions: Float

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

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
    ///   - samplingRateForErrorFreeSessions: Sampling rate for sessions without a crash. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.5` will export only 50% of the non-crashed sessions, and a value of `0` will disable sending non-crashed sessions to the server.
    ///   - trackHttpHeaders: Whether to capture http headers of a network request and response. Defaults to `false`.
    ///   - trackHttpBody:Whether to capture http body of a network request and response. Defaults to `false`.
    ///   - httpHeadersBlocklist:List of HTTP headers to not collect with the `http` event for both request and response. Defaults to an empty list. The following headers are always excluded:
    ///       - Authorization
    ///       - Cookie
    ///       - Set-Cookie
    ///       - Proxy-Authorization
    ///       - WWW-Authenticate
    ///       - X-Api-Key
    ///   - httpUrlBlocklist: Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not want to collect data for certain endpoints.Note that this config is ignored if [httpUrlAllowlist] is set. You can:
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
                trackHttpHeaders: Bool? = nil,
                trackHttpBody: Bool? = nil,
                httpHeadersBlocklist: [String]? = nil,
                httpUrlBlocklist: [String]? = nil,
                httpUrlAllowlist: [String]? = nil,
                autoStart: Bool? = nil) {
        self.enableLogging = enableLogging ?? DefaultConfig.enableLogging
        self.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions ?? DefaultConfig.sessionSamplingRate
        self.trackHttpHeaders = trackHttpHeaders ?? DefaultConfig.trackHttpHeaders
        self.trackHttpBody = trackHttpBody ?? DefaultConfig.trackHttpBody
        self.httpHeadersBlocklist = httpHeadersBlocklist ?? DefaultConfig.httpHeadersBlocklist
        self.httpUrlBlocklist = httpUrlBlocklist ?? DefaultConfig.httpUrlBlocklist
        self.httpUrlAllowlist = httpUrlAllowlist ?? DefaultConfig.httpUrlAllowlist
        self.autoStart = autoStart ?? DefaultConfig.autoStart

        if !(0.0...1.0).contains(self.samplingRateForErrorFreeSessions) {
            debugPrint("Session sampling rate must be between 0.0 and 1.0")
        }
    }
}
