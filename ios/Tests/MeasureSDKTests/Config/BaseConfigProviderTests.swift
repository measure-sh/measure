//
//  BaseConfigProviderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import XCTest
@testable import Measure

final class BaseConfigProviderTests: XCTestCase {
    private var defaultConfig: Config!
    private var mockConfigLoader: MockConfigLoader!
    private var baseConfigProvider: BaseConfigProvider!

    override func setUp() {
        super.setUp()
        defaultConfig = Config()
        mockConfigLoader = MockConfigLoader()
        baseConfigProvider = BaseConfigProvider(defaultConfig: defaultConfig)
    }

    override func tearDown() {
        defaultConfig = nil
        mockConfigLoader = nil
        baseConfigProvider = nil
        super.tearDown()
    }
    // TODO: add tests
}
