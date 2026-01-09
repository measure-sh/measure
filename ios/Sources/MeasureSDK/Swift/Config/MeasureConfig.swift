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

    /// Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API. This is useful only for self-hosted clients who may require additional headers for requests in their infrastructure.
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

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
    ///   - autoStart: Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
    ///   - requestHeadersProvider: Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API.
    ///   - maxDiskUsageInMb: Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use. Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`.
    ///   - enableFullCollectionMode: Override all sampling configs and track all events and traces. **Note** that enabling this flag can significantly increase the cost and should typically only be enabled for debug mode.
    public init(enableLogging: Bool? = nil,
                autoStart: Bool? = nil,
                requestHeadersProvider: MsrRequestHeadersProvider? = nil,
                maxDiskUsageInMb: Int? = nil,
                enableFullCollectionMode: Bool? = nil) {
        self.enableLogging = enableLogging ?? DefaultConfig.enableLogging
        self.autoStart = autoStart ?? DefaultConfig.autoStart
        self.enableFullCollectionMode = enableFullCollectionMode ?? DefaultConfig.enableFullCollectionMode
        self.requestHeadersProvider = requestHeadersProvider

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
    ///   - enableFullCollectionMode: Override all sampling configs and track all events and traces. **Note** that enabling this flag can significantly increase the cost and should typically only be enabled for debug mode.
    @objc public convenience init(enableLogging: Bool,
                                  autoStart: Bool,
                                  requestHeadersProvider: MsrRequestHeadersProvider?,
                                  maxDiskUsageInMb: NSNumber?,
                                  enableFullCollectionMode: Bool) {
        self.init(enableLogging: enableLogging,
                  autoStart: autoStart,
                  requestHeadersProvider: requestHeadersProvider,
                  maxDiskUsageInMb: maxDiskUsageInMb?.intValue,
                  enableFullCollectionMode: enableFullCollectionMode)
        
    }

    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        enableLogging = try container.decodeIfPresent(Bool.self, forKey: .enableLogging) ?? DefaultConfig.enableLogging
        autoStart = try container.decodeIfPresent(Bool.self, forKey: .autoStart) ?? DefaultConfig.autoStart
        enableFullCollectionMode = try container.decodeIfPresent(Bool.self, forKey: .enableFullCollectionMode) ?? DefaultConfig.enableFullCollectionMode
        requestHeadersProvider = nil // requestHeadersProvider is not encodable

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
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(enableLogging, forKey: .enableLogging)
        try container.encode(autoStart, forKey: .autoStart)
        try container.encode(maxDiskUsageInMb, forKey: .maxDiskUsageInMb)
        try container.encode(enableFullCollectionMode, forKey: .enableFullCollectionMode)
    }
}
