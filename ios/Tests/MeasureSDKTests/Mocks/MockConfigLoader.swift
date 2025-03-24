//
//  MockConfigLoader.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import Foundation
@testable import Measure

final class MockConfigLoader: ConfigLoader {
    var cachedConfig: Config?
    var networkConfig: Config?

    func getCachedConfig() -> Config? {
        return cachedConfig
    }

    func getNetworkConfig(onSuccess: @escaping (Config) -> Void) {
        onSuccess(networkConfig!)
    }
}
