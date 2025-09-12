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
        baseConfigProvider = BaseConfigProvider(defaultConfig: defaultConfig, configLoader: mockConfigLoader)
    }

    override func tearDown() {
        defaultConfig = nil
        mockConfigLoader = nil
        baseConfigProvider = nil
        super.tearDown()
    }

    func testMergedConfigUsesNetworkConfigIfAvailable() {
        let networkConfig = Config(enableLogging: false, samplingRateForErrorFreeSessions: 0.2)
        mockConfigLoader.networkConfig = networkConfig
        baseConfigProvider.loadNetworkConfig()

        XCTAssertEqual(baseConfigProvider.samplingRateForErrorFreeSessions, 0.2)
        XCTAssertEqual(baseConfigProvider.enableLogging, false)
    }

    func testMergedConfigUsesCachedConfigIfNoNetworkConfig() {
        let cachedConfig = Config(enableLogging: true, samplingRateForErrorFreeSessions: 0.15)
        mockConfigLoader.cachedConfig = cachedConfig
        baseConfigProvider = BaseConfigProvider(defaultConfig: defaultConfig, configLoader: mockConfigLoader)

        XCTAssertEqual(baseConfigProvider.samplingRateForErrorFreeSessions, 0.15)
        XCTAssertEqual(baseConfigProvider.enableLogging, true)
    }

    func testMergedConfigUsesDefaultConfigIfNoNetworkOrCachedConfig() {
        XCTAssertEqual(baseConfigProvider.samplingRateForErrorFreeSessions, DefaultConfig.sessionSamplingRate)
        XCTAssertEqual(baseConfigProvider.enableLogging, DefaultConfig.enableLogging)
        XCTAssertEqual(baseConfigProvider.traceSamplingRate, DefaultConfig.traceSamplingRate)
        XCTAssertEqual(baseConfigProvider.trackHttpHeaders, DefaultConfig.trackHttpHeaders)
        XCTAssertEqual(baseConfigProvider.httpHeadersBlocklist, DefaultConfig.httpHeadersBlocklist)
        XCTAssertEqual(baseConfigProvider.httpUrlAllowlist, DefaultConfig.httpUrlAllowlist)
        XCTAssertEqual(baseConfigProvider.sessionEndLastEventThresholdMs, 20 * 60 * 1000) // 20 minutes
        XCTAssertEqual(baseConfigProvider.eventsBatchingIntervalMs, 30000) // 30 seconds
        XCTAssertEqual(baseConfigProvider.maxEventsInBatch, 500)
        XCTAssertEqual(baseConfigProvider.timeoutIntervalForRequest, 30) // 30 seconds
        XCTAssertEqual(baseConfigProvider.longPressTimeout, 500) // 500 ms
        XCTAssertEqual(baseConfigProvider.scaledTouchSlop, 3.5) // 3.5 points
        XCTAssertEqual(baseConfigProvider.maxAttachmentSizeInEventsBatchInBytes, 3_000_000) // 3 MB
        XCTAssertEqual(baseConfigProvider.maxSessionDurationMs, 6 * 60 * 60 * 1000) // 6 hours
        XCTAssertEqual(baseConfigProvider.cpuTrackingIntervalMs, 3 * 1000) // 3 seconds
        XCTAssertEqual(baseConfigProvider.memoryTrackingIntervalMs, 2 * 1000) // 2 seconds
        XCTAssertEqual(baseConfigProvider.screenshotMaskHexColor, "#222222")
        XCTAssertEqual(baseConfigProvider.screenshotCompressionQuality, 25)
        XCTAssertEqual(baseConfigProvider.layoutSnapshotDebounceInterval, 750)
        XCTAssertEqual(baseConfigProvider.httpContentTypeAllowlist, ["application/json"])
        XCTAssertEqual(baseConfigProvider.defaultHttpHeadersBlocklist, [
                "Authorization",
                "Cookie",
                "Set-Cookie",
                "Proxy-Authorization",
                "WWW-Authenticate",
                "X-Api-Key"
            ])
        XCTAssertEqual(baseConfigProvider.customEventNameRegex, "^[a-zA-Z0-9_-]+$")
        XCTAssertEqual(baseConfigProvider.maxEventNameLength, 64)
        XCTAssertEqual(baseConfigProvider.maxUserDefinedAttributeKeyLength, 256)
        XCTAssertEqual(baseConfigProvider.maxUserDefinedAttributeValueLength, 256)
        XCTAssertEqual(baseConfigProvider.maxUserDefinedAttributesPerEvent, 100)
        XCTAssertEqual(baseConfigProvider.eventTypeExportAllowList, [
                .coldLaunch,
                .hotLaunch,
                .warmLaunch,
                .lifecycleSwiftUI,
                .lifecycleViewController,
                .screenView,
                .sessionStart
            ])
        XCTAssertTrue(baseConfigProvider.autoStart)
        XCTAssertEqual(baseConfigProvider.maxSpanNameLength, 64)
        XCTAssertEqual(baseConfigProvider.maxCheckpointNameLength, 64)
        XCTAssertEqual(baseConfigProvider.maxCheckpointsPerSpan, 100)
    }

    func testLoadNetworkConfigUpdatesNetworkConfig() {
        let networkConfig = Config(
            enableLogging: false,
            samplingRateForErrorFreeSessions: 0.25
        )

        mockConfigLoader.networkConfig = networkConfig

        baseConfigProvider.loadNetworkConfig()

        XCTAssertEqual(baseConfigProvider.samplingRateForErrorFreeSessions, 0.25)
        XCTAssertEqual(baseConfigProvider.enableLogging, false)
        XCTAssertEqual(baseConfigProvider.sessionEndLastEventThresholdMs, 20 * 60 * 1000) // 20 minutes
        XCTAssertEqual(baseConfigProvider.eventsBatchingIntervalMs, 30000) // 30 seconds
        XCTAssertEqual(baseConfigProvider.maxEventsInBatch, 500)
        XCTAssertEqual(baseConfigProvider.timeoutIntervalForRequest, 30) // 30 seconds
        XCTAssertEqual(baseConfigProvider.longPressTimeout, 500) // 500 seconds
        XCTAssertEqual(baseConfigProvider.scaledTouchSlop, 3.5) // 3.5 points
        XCTAssertEqual(baseConfigProvider.maxAttachmentSizeInEventsBatchInBytes, 3_000_000) // 3 MB
        XCTAssertEqual(baseConfigProvider.maxSessionDurationMs, 6 * 60 * 60 * 1000) // 6 hours
        XCTAssertEqual(baseConfigProvider.cpuTrackingIntervalMs, 3 * 1000) // 3 seconds
        XCTAssertEqual(baseConfigProvider.memoryTrackingIntervalMs, 2 * 1000) // 2 seconds
        XCTAssertEqual(baseConfigProvider.screenshotMaskHexColor, "#222222")
        XCTAssertEqual(baseConfigProvider.screenshotCompressionQuality, 25)
        XCTAssertEqual(baseConfigProvider.layoutSnapshotDebounceInterval, 750)
    }
}
