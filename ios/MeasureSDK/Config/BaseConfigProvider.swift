//
//  ConfigProvider.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Configuration Provider for the Measure SDK. See `BaseConfigProvider` for details.
protocol ConfigProvider: MeasureConfig, InternalConfig {
    func loadNetworkConfig()
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
    private let configLoader: ConfigLoader
    private var cachedConfig: Config?
    private var networkConfig: Config?

    init(defaultConfig: Config, configLoader: ConfigLoader) {
        self.defaultConfig = defaultConfig
        self.configLoader = configLoader
        self.cachedConfig = configLoader.getCachedConfig()
    }

    var maxUserDefinedAttributesPerEvent: Int {
        return getMergedConfig(\.maxUserDefinedAttributesPerEvent)
    }

    var maxUserDefinedAttributeKeyLength: Int {
        return getMergedConfig(\.maxUserDefinedAttributeKeyLength)
    }

    var maxUserDefinedAttributeValueLength: Int {
        return getMergedConfig(\.maxUserDefinedAttributeValueLength)
    }

    var maxEventNameLength: Int {
        return getMergedConfig(\.maxEventNameLength)
    }

    var customEventNameRegex: String {
        return getMergedConfig(\.customEventNameRegex)
    }

    var maxSessionDurationMs: Number {
        return getMergedConfig(\.maxSessionDurationMs)
    }

    var maxAttachmentSizeInEventsBatchInBytes: Number {
        return getMergedConfig(\.maxAttachmentSizeInEventsBatchInBytes)
    }

    var timeoutIntervalForRequest: TimeInterval {
        return getMergedConfig(\.timeoutIntervalForRequest)
    }

    var maxEventsInBatch: Number {
        return getMergedConfig(\.maxEventsInBatch)
    }

    var sessionSamplingRate: Float {
        return getMergedConfig(\.sessionSamplingRate)
    }

    var enableLogging: Bool {
        return getMergedConfig(\.enableLogging)
    }

    var trackScreenshotOnCrash: Bool {
        return getMergedConfig(\.trackScreenshotOnCrash)
    }

    var eventsBatchingIntervalMs: Number {
        return getMergedConfig(\.eventsBatchingIntervalMs)
    }

    var sessionEndLastEventThresholdMs: Number {
        return getMergedConfig(\.sessionEndLastEventThresholdMs)
    }

    var longPressTimeout: TimeInterval {
        return getMergedConfig(\.longPressTimeout)
    }

    var scaledTouchSlop: CGFloat {
        return getMergedConfig(\.scaledTouchSlop)
    }

    var memoryTrackingIntervalMs: UnsignedNumber {
        return getMergedConfig(\.memoryTrackingIntervalMs)
    }

    var cpuTrackingIntervalMs: UnsignedNumber {
        return getMergedConfig(\.cpuTrackingIntervalMs)
    }

    var httpContentTypeAllowlist: [String] {
        return getMergedConfig(\.httpContentTypeAllowlist)
    }

    var defaultHttpHeadersBlocklist: [String] {
        return getMergedConfig(\.defaultHttpHeadersBlocklist)
    }

    private func getMergedConfig<T>(_ keyPath: KeyPath<Config, T>) -> T {
        if let networkConfig = networkConfig {
            return networkConfig[keyPath: keyPath]
        } else if let cachedConfig = cachedConfig {
            return cachedConfig[keyPath: keyPath]
        } else {
            return defaultConfig[keyPath: keyPath]
        }
    }

    func loadNetworkConfig() {
        configLoader.getNetworkConfig { [weak self] config in
            guard let self = self else { return }
            self.networkConfig = config
        }
    }
}
