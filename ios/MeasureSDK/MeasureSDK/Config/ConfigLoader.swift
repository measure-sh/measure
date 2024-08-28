//
//  ConfigLoader.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

/// A protocol that defines the methods for loading configuration data either a cache or a network source.
protocol ConfigLoader {
    func getCachedConfig() -> Config?
    func getNetworkConfig(onSuccess: @escaping (Config) -> Void)
}

/// A base implementation of the `ConfigLoader` protocol.
struct BaseConfigLoader: ConfigLoader {
    /// Returns the cached configuration if available.
    /// - Returns: Optional cached `Confg`
    func getCachedConfig() -> Config? {
        // swiftlint:disable todo
        // TODO: Load the cached config from disk.
        return nil
    }

    /// Fetches a fresh configuration from the server.
    /// - Parameter onSuccess: A closure that returns a server `Config`
    func getNetworkConfig(onSuccess: @escaping (Config) -> Void) {
        // TODO: Fetch the config from the server, write it to disk, and call onSuccess.
        // swiftlint:enable todo
    }
}
