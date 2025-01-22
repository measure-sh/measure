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
        let networkConfig = Config(enableLogging: false, trackScreenshotOnCrash: true, samplingRateForErrorFreeSessions: 0.2)
        mockConfigLoader.networkConfig = networkConfig
        baseConfigProvider.loadNetworkConfig()

        XCTAssertEqual(baseConfigProvider.samplingRateForErrorFreeSessions, 0.2)
        XCTAssertEqual(baseConfigProvider.enableLogging, false)
        XCTAssertEqual(baseConfigProvider.trackScreenshotOnCrash, true)
    }

    func testMergedConfigUsesCachedConfigIfNoNetworkConfig() {
        let cachedConfig = Config(enableLogging: true, trackScreenshotOnCrash: true, samplingRateForErrorFreeSessions: 0.15)
        mockConfigLoader.cachedConfig = cachedConfig
        baseConfigProvider = BaseConfigProvider(defaultConfig: defaultConfig, configLoader: mockConfigLoader)

        XCTAssertEqual(baseConfigProvider.samplingRateForErrorFreeSessions, 0.15)
        XCTAssertEqual(baseConfigProvider.enableLogging, true)
        XCTAssertEqual(baseConfigProvider.trackScreenshotOnCrash, true)
    }

    func testMergedConfigUsesDefaultConfigIfNoNetworkOrCachedConfig() {
        XCTAssertEqual(baseConfigProvider.samplingRateForErrorFreeSessions, 0.0)
        XCTAssertEqual(baseConfigProvider.enableLogging, false)
        XCTAssertEqual(baseConfigProvider.trackScreenshotOnCrash, true)
        XCTAssertEqual(baseConfigProvider.sessionEndLastEventThresholdMs, 1200000)
        XCTAssertEqual(baseConfigProvider.eventsBatchingIntervalMs, 30000)
    }

    func testLoadNetworkConfigUpdatesNetworkConfig() {
        let networkConfig = Config(enableLogging: false, trackScreenshotOnCrash: false, samplingRateForErrorFreeSessions: 0.25)

        mockConfigLoader.networkConfig = networkConfig

        baseConfigProvider.loadNetworkConfig()

        XCTAssertEqual(baseConfigProvider.samplingRateForErrorFreeSessions, 0.25)
        XCTAssertEqual(baseConfigProvider.enableLogging, false)
        XCTAssertEqual(baseConfigProvider.trackScreenshotOnCrash, false)
        XCTAssertEqual(baseConfigProvider.sessionEndLastEventThresholdMs, 1200000)
        XCTAssertEqual(baseConfigProvider.eventsBatchingIntervalMs, 30000)
        XCTAssertEqual(baseConfigProvider.maxEventsInBatch, 500)
        XCTAssertEqual(baseConfigProvider.longPressTimeout, 0.5)
        XCTAssertEqual(baseConfigProvider.scaledTouchSlop, 3.5)
        XCTAssertEqual(baseConfigProvider.maxAttachmentSizeInEventsBatchInBytes, 3_000_000)
    }
}
