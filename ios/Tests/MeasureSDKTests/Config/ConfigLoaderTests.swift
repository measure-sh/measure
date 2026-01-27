//
//  ConfigLoaderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/01/26.
//

import XCTest
@testable import Measure

import XCTest

final class ConfigLoaderTests: XCTestCase {
    private var mockNetworkClient: MockNetworkClient!
    private var mockUserDefaults: MockUserDefaultStorage!
    private var mockFileManager: MockSystemFileManager!
    private var configLoader: ConfigLoader!

    override func setUp() {
        super.setUp()

        mockNetworkClient = MockNetworkClient()
        mockUserDefaults = MockUserDefaultStorage()
        mockFileManager = MockSystemFileManager()

        configLoader = BaseConfigLoader(
            userDefaultStorage: mockUserDefaults,
            fileManager: mockFileManager,
            networkClient: mockNetworkClient,
            logger: MockLogger()
        )
    }

    override func tearDown() {
        configLoader = nil
        mockNetworkClient = nil
        mockUserDefaults = nil
        mockFileManager = nil
        super.tearDown()
    }

    func testLoadConfig_success_savesConfigAndEtag() {
        // Given
        let config = BaseDynamicConfig.default()
        let eTag = "etag-123"

        mockNetworkClient.stubConfig(config, eTag: eTag)

        let expectation = expectation(description: "Config loaded")

        // When
        configLoader.loadDynamicConfig { loadedConfig in
            let result = loadedConfig as? BaseDynamicConfig

            // ✅ One line instead of 20 asserts
            self.assertConfigsEqual(result, config)

            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1)
    }

    func testLoadConfig_passesStoredEtagToNetwork() {
        // Given
        mockUserDefaults.setConfigEtag("old-etag")

        // When
        configLoader.loadDynamicConfig { _ in }

        // Then
        XCTAssertEqual(mockNetworkClient.lastETag, "old-etag")
    }

    func testLoadConfig_persistsEtag() {
        // Given
        let config = BaseDynamicConfig.default()

        mockNetworkClient.stubConfig(config, eTag: "new-etag")

        let expectation = expectation(description: "Loaded")

        // When
        configLoader.loadDynamicConfig { _ in
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1)

        // Then
        XCTAssertEqual(mockUserDefaults.getConfigEtag(), "new-etag")
    }

    private func assertConfigsEqual(
        _ actual: BaseDynamicConfig?,
        _ expected: BaseDynamicConfig,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        guard let actual else {
            XCTFail("Config is nil", file: file, line: line)
            return
        }

        XCTAssertEqual(actual.maxEventsInBatch, expected.maxEventsInBatch, file: file, line: line)
        XCTAssertEqual(actual.crashTimelineDurationSeconds, expected.crashTimelineDurationSeconds, file: file, line: line)
        XCTAssertEqual(actual.anrTimelineDurationSeconds, expected.anrTimelineDurationSeconds, file: file, line: line)
        XCTAssertEqual(actual.bugReportTimelineDurationSeconds, expected.bugReportTimelineDurationSeconds, file: file, line: line)

        XCTAssertEqual(actual.traceSamplingRate, expected.traceSamplingRate, file: file, line: line)
        XCTAssertEqual(actual.journeySamplingRate, expected.journeySamplingRate, file: file, line: line)
        XCTAssertEqual(actual.screenshotMaskLevel, expected.screenshotMaskLevel, file: file, line: line)

        XCTAssertEqual(actual.cpuUsageInterval, expected.cpuUsageInterval, file: file, line: line)
        XCTAssertEqual(actual.memoryUsageInterval, expected.memoryUsageInterval, file: file, line: line)

        XCTAssertEqual(actual.crashTakeScreenshot, expected.crashTakeScreenshot, file: file, line: line)
        XCTAssertEqual(actual.anrTakeScreenshot, expected.anrTakeScreenshot, file: file, line: line)
        XCTAssertEqual(actual.launchSamplingRate, expected.launchSamplingRate, file: file, line: line)
        XCTAssertEqual(actual.gestureClickTakeSnapshot, expected.gestureClickTakeSnapshot, file: file, line: line)

        XCTAssertEqual(actual.httpDisableEventForUrls, expected.httpDisableEventForUrls, file: file, line: line)
        XCTAssertEqual(actual.httpTrackRequestForUrls, expected.httpTrackRequestForUrls, file: file, line: line)
        XCTAssertEqual(actual.httpTrackResponseForUrls, expected.httpTrackResponseForUrls, file: file, line: line)
        XCTAssertEqual(actual.httpBlockedHeaders, expected.httpBlockedHeaders, file: file, line: line)
    }
}
