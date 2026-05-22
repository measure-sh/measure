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
    private let autoSetConfigLoaded: Bool

    private(set) var isConfigLoaded: Bool = false
    private(set) var didLoadConfig: Bool = false

    init(config: DynamicConfig = BaseDynamicConfig(), autoSetConfigLoaded: Bool = true) {
        self.config = config
        self.autoSetConfigLoaded = autoSetConfigLoaded
    }

    func loadDynamicConfig(onLoaded: @escaping (DynamicConfig) -> Void) {
        if autoSetConfigLoaded {
            isConfigLoaded = true
        }
        onLoaded(config)
    }
}
