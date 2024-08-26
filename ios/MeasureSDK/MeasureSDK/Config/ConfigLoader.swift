//
//  ConfigLoader.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

protocol ConfigLoaderProtocol {
    /// Returns the cached config synchronously, if available. Returns `nil` if cached config is
    /// unavailable or failed to load.
    func getCachedConfig() -> Config?

    /// Fetches a fresh config from the server asynchronously and calls `onSuccess` with the result,
    /// if successful. Ignores the result if the fetch fails.
    func getNetworkConfig(onSuccess: @escaping (Config) -> Void)
}

struct ConfigLoader: ConfigLoaderProtocol {
    func getCachedConfig() -> Config? {
        // swiftlint:disable todo
        // TODO: Load the cached config from disk.
        return nil
    }

    func getNetworkConfig(onSuccess: @escaping (Config) -> Void) {
        // TODO: Fetch the config from the server, write it to disk, and call onSuccess.
        // swiftlint:enable todo
    }
}
