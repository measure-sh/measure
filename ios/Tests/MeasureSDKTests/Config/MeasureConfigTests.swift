//
//  MeasureConfigTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 25/11/25.
//

import XCTest
@testable import Measure

final class MeasureConfigTests: XCTestCase {
    func testAllCodingKeysDecodeCorrectly() throws {
        let json = """
        {
            "enableLogging": true,
            "samplingRateForErrorFreeSessions": 0.42,
            "traceSamplingRate": 0.77,
            "coldLaunchSamplingRate": 0.12,
            "warmLaunchSamplingRate": 0.34,
            "hotLaunchSamplingRate": 0.56,
            "journeySamplingRate": 0.78,
            "trackHttpHeaders": true,
            "trackHttpBody": true,
            "httpHeadersBlocklist": ["A", "B"],
            "httpUrlBlocklist": ["blocked"],
            "httpUrlAllowlist": ["allowed"],
            "autoStart": false,
            "screenshotMaskLevel": "allTextAndMedia",
            "maxDiskUsageInMb": 999
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let config = try decoder.decode(BaseMeasureConfig.self, from: json)

        XCTAssertTrue(config.enableLogging)
        XCTAssertEqual(config.samplingRateForErrorFreeSessions, 0.42)
        XCTAssertEqual(config.traceSamplingRate, 0.77)
        XCTAssertEqual(config.coldLaunchSamplingRate, 0.12)
        XCTAssertEqual(config.warmLaunchSamplingRate, 0.34)
        XCTAssertEqual(config.hotLaunchSamplingRate, 0.56)
        XCTAssertEqual(config.journeySamplingRate, 0.78)
        XCTAssertTrue(config.trackHttpHeaders)
        XCTAssertTrue(config.trackHttpBody)
        XCTAssertEqual(config.httpHeadersBlocklist, ["A", "B"])
        XCTAssertEqual(config.httpUrlBlocklist, ["blocked"])
        XCTAssertEqual(config.httpUrlAllowlist, ["allowed"])
        XCTAssertFalse(config.autoStart)
        XCTAssertEqual(config.maxDiskUsageInMb, 999)
    }

    func testSamplingRatesBelowZeroClampToDefault() {
        let config = BaseMeasureConfig(
            samplingRateForErrorFreeSessions: -1,
            traceSamplingRate: -0.5,
            coldLaunchSamplingRate: -0.2,
            warmLaunchSamplingRate: -0.3,
            hotLaunchSamplingRate: -0.9,
            journeySamplingRate: -0.1
        )

        XCTAssertEqual(config.samplingRateForErrorFreeSessions, DefaultConfig.sessionSamplingRate)
        XCTAssertEqual(config.traceSamplingRate, DefaultConfig.traceSamplingRate)
        XCTAssertEqual(config.coldLaunchSamplingRate, DefaultConfig.coldLaunchSamplingRate)
        XCTAssertEqual(config.warmLaunchSamplingRate, DefaultConfig.warmLaunchSamplingRate)
        XCTAssertEqual(config.hotLaunchSamplingRate, DefaultConfig.hotLaunchSamplingRate)
        XCTAssertEqual(config.journeySamplingRate, DefaultConfig.journeySamplingRate)
    }

    func testSamplingRatesAboveOneClampToDefault() {
        let config = BaseMeasureConfig(
            samplingRateForErrorFreeSessions: 1.5,
            traceSamplingRate: 2.0,
            coldLaunchSamplingRate: 3.0,
            warmLaunchSamplingRate: 4.0,
            hotLaunchSamplingRate: 9.0,
            journeySamplingRate: 5.0
        )

        XCTAssertEqual(config.samplingRateForErrorFreeSessions, DefaultConfig.sessionSamplingRate)
        XCTAssertEqual(config.traceSamplingRate, DefaultConfig.traceSamplingRate)
        XCTAssertEqual(config.coldLaunchSamplingRate, DefaultConfig.coldLaunchSamplingRate)
        XCTAssertEqual(config.warmLaunchSamplingRate, DefaultConfig.warmLaunchSamplingRate)
        XCTAssertEqual(config.hotLaunchSamplingRate, DefaultConfig.hotLaunchSamplingRate)
        XCTAssertEqual(config.journeySamplingRate, DefaultConfig.journeySamplingRate)
    }

    func testDiskUsageBelowMinimumIsClamped() {
        let config = BaseMeasureConfig(maxDiskUsageInMb: 5)
        XCTAssertEqual(config.maxDiskUsageInMb, 20)
    }

    func testDiskUsageAboveMaximumIsClamped() {
        let config = BaseMeasureConfig(maxDiskUsageInMb: 5000)
        XCTAssertEqual(config.maxDiskUsageInMb, 1500)
    }

    func testDiskUsageWithinRangeIsAccepted() {
        let config = BaseMeasureConfig(maxDiskUsageInMb: 300)
        XCTAssertEqual(config.maxDiskUsageInMb, 300)
    }

    func testDecodingInvalidSamplingRatesAppliesValidation() throws {
        let json = """
        {
            "samplingRateForErrorFreeSessions": -1,
            "traceSamplingRate": 2,
            "coldLaunchSamplingRate": -5,
            "warmLaunchSamplingRate": 10,
            "hotLaunchSamplingRate": -0.1,
            "journeySamplingRate": 99
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let config = try decoder.decode(BaseMeasureConfig.self, from: json)

        XCTAssertEqual(config.samplingRateForErrorFreeSessions, DefaultConfig.sessionSamplingRate)
        XCTAssertEqual(config.traceSamplingRate, DefaultConfig.traceSamplingRate)
        XCTAssertEqual(config.coldLaunchSamplingRate, DefaultConfig.coldLaunchSamplingRate)
        XCTAssertEqual(config.warmLaunchSamplingRate, DefaultConfig.warmLaunchSamplingRate)
        XCTAssertEqual(config.hotLaunchSamplingRate, DefaultConfig.hotLaunchSamplingRate)
        XCTAssertEqual(config.journeySamplingRate, DefaultConfig.journeySamplingRate)
    }
}
