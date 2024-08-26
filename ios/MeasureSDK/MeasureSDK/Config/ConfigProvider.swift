//
//  ConfigProvider.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

protocol ConfigProviderProtocol: MeasureConfigProtocol, InternalConfig {
    func loadNetworkConfig()
}

class ConfigProvider: ConfigProviderProtocol {
    private let defaultConfig: Config
    private let configLoader: ConfigLoaderProtocol
    private var cachedConfig: Config?
    private var networkConfig: Config?

    init(defaultConfig: Config, configLoader: ConfigLoaderProtocol) {
        self.defaultConfig = defaultConfig
        self.configLoader = configLoader
        self.cachedConfig = configLoader.getCachedConfig()
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

    var eventsBatchingIntervalMs: TimeInterval {
        return getMergedConfig(\.eventsBatchingIntervalMs)
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
