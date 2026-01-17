//
//  MockConfigLoader.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import Foundation
@testable import Measure

final class MockConfigLoader: ConfigLoader {
    private let config: DynamicConfig

    private(set) var didLoadConfig: Bool = false

    init(config: DynamicConfig = BaseDynamicConfig.default()) {
        self.config = config
    }

    func loadDynamicConfig(onLoaded: @escaping (DynamicConfig) -> Void) {
        onLoaded(config)
    }
}
