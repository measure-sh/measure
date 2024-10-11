//
//  BaseConfigProviderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import XCTest
@testable import MeasureSDK

final class BaseConfigProviderTests: XCTestCase {
    private var defaultConfig: Config!
    private var mockConfigLoader: MockConfigLoader!
    private var baseConfigProvider: BaseConfigProvider!

    override func setUp() {
        super.setUp()
        defaultConfig = Config()
        mockConfigLoader = MockConfigLoader()
        baseConfigProvider = BaseConfigProvider(defaultConfig: defaultConfig, configLoader: mockConfigLoader)
    }

    override func tearDown() {
        defaultConfig = nil
        mockConfigLoader = nil
        baseConfigProvider = nil
        super.tearDown()
    }

    func testMergedConfigUsesNetworkConfigIfAvailable() {
        let networkConfig = Config(enableLogging: false, trackScreenshotOnCrash: true, sessionSamplingRate: 0.2)
        mockConfigLoader.networkConfig = networkConfig
        baseConfigProvider.loadNetworkConfig()

        XCTAssertEqual(baseConfigProvider.sessionSamplingRate, 0.2)
        XCTAssertEqual(baseConfigProvider.enableLogging, false)
        XCTAssertEqual(baseConfigProvider.trackScreenshotOnCrash, true)
    }

    func testMergedConfigUsesCachedConfigIfNoNetworkConfig() {
        let cachedConfig = Config(enableLogging: true, trackScreenshotOnCrash: true, sessionSamplingRate: 0.15)
        mockConfigLoader.cachedConfig = cachedConfig
        baseConfigProvider = BaseConfigProvider(defaultConfig: defaultConfig, configLoader: mockConfigLoader)

        XCTAssertEqual(baseConfigProvider.sessionSamplingRate, 0.15)
        XCTAssertEqual(baseConfigProvider.enableLogging, true)
        XCTAssertEqual(baseConfigProvider.trackScreenshotOnCrash, true)
    }

    func testMergedConfigUsesDefaultConfigIfNoNetworkOrCachedConfig() {
        XCTAssertEqual(baseConfigProvider.sessionSamplingRate, 1.0)
        XCTAssertEqual(baseConfigProvider.enableLogging, false)
        XCTAssertEqual(baseConfigProvider.trackScreenshotOnCrash, true)
        XCTAssertEqual(baseConfigProvider.sessionEndThresholdMs, 60000)
        XCTAssertEqual(baseConfigProvider.eventsBatchingIntervalMs, 30000)
    }

    func testLoadNetworkConfigUpdatesNetworkConfig() {
        let networkConfig = Config(enableLogging: false, trackScreenshotOnCrash: false, sessionSamplingRate: 0.25)

        mockConfigLoader.networkConfig = networkConfig

        baseConfigProvider.loadNetworkConfig()

        XCTAssertEqual(baseConfigProvider.sessionSamplingRate, 0.25)
        XCTAssertEqual(baseConfigProvider.enableLogging, false)
        XCTAssertEqual(baseConfigProvider.trackScreenshotOnCrash, false)
        XCTAssertEqual(baseConfigProvider.sessionEndThresholdMs, 60000)
        XCTAssertEqual(baseConfigProvider.eventsBatchingIntervalMs, 30000)
    }
}
