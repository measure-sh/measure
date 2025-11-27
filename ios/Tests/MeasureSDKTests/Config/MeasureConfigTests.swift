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
}
