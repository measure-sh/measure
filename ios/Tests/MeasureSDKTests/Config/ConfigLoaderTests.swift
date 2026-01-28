//
//  ConfigLoaderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/01/26.
//

import XCTest
@testable import Measure

final class ConfigLoaderTests: XCTestCase {
    private var mockNetworkClient: MockNetworkClient!
    private var mockUserDefaults: MockUserDefaultStorage!
    private var mockFileManager: MockSystemFileManager!
    private var mockTimeProvider: MockTimeProvider!
    private var configLoader: ConfigLoader!

    override func setUp() {
        super.setUp()

        mockNetworkClient = MockNetworkClient()
        mockUserDefaults = MockUserDefaultStorage()
        mockFileManager = MockSystemFileManager()
        mockTimeProvider = MockTimeProvider()

        configLoader = BaseConfigLoader(
            userDefaultStorage: mockUserDefaults,
            fileManager: mockFileManager,
            networkClient: mockNetworkClient,
            timeProvider: mockTimeProvider,
            logger: MockLogger()
        )
    }

    override func tearDown() {
        configLoader = nil
        mockNetworkClient = nil
        mockUserDefaults = nil
        mockFileManager = nil
        mockTimeProvider = nil
        super.tearDown()
    }

    // MARK: - Disk loading

    func testLoadDynamicConfig_returnsDefault_whenNoFile() {
        let exp = expectation(description: "loaded")

        configLoader.loadDynamicConfig { config in
            XCTAssertNotNil(config)
            exp.fulfill()
        }

        wait(for: [exp], timeout: 1)
    }

    func testLoadDynamicConfig_returnsDefault_whenInvalidJSON() {
        mockFileManager.savedFiles["config/config.json"] = Data("{ invalid".utf8)

        let exp = expectation(description: "loaded")

        configLoader.loadDynamicConfig { config in
            XCTAssertNotNil(config)
            exp.fulfill()
        }

        wait(for: [exp], timeout: 1)
    }

    func testLoadDynamicConfig_returnsConfig_whenValidFileExists() throws {
        let expected = BaseDynamicConfig.default()
        let data = try JSONEncoder().encode(expected)

        mockFileManager.savedFiles["config/config.json"] = data

        // Cache NOT expired
        mockUserDefaults.configFetchTimestamp = 1000
        mockUserDefaults.configCacheControl = 10_000
        mockTimeProvider.current = 2000

        let exp = expectation(description: "loaded")

        configLoader.loadDynamicConfig { loaded in
            let result = loaded as? BaseDynamicConfig
            self.assertConfigsEqual(result, expected)
            exp.fulfill()
        }

        wait(for: [exp], timeout: 1)
    }

    // MARK: - Cache + network

    func testLoadConfig_fetchesConfig_whenCacheExpired() {
        setupCacheExpired()

        mockNetworkClient.configResponse = .notModified

        configLoader.loadDynamicConfig { _ in }

        XCTAssertEqual(mockNetworkClient.lastETag, "")
    }

    func testLoadConfig_success_updatesFileAndPrefs() throws {
        setupCacheExpired()

        let config = BaseDynamicConfig.default()
        let eTag = "new-etag"
        let cache: Number = 3600

        mockNetworkClient.stubConfig(.success(config: config, eTag: eTag, cacheControl: cache))

        configLoader.loadDynamicConfig { _ in }

        let key = "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.fileName)"
        let saved = try XCTUnwrap(mockFileManager.savedFiles[key])
        let decoded = try JSONDecoder().decode(BaseDynamicConfig.self, from: saved)

        assertConfigsEqual(decoded, config)

        XCTAssertEqual(mockUserDefaults.configFetchTimestamp, mockTimeProvider.current)
        XCTAssertEqual(mockUserDefaults.configCacheControl, cache)
        XCTAssertEqual(mockUserDefaults.eTag, eTag)
    }

    func testLoadConfig_doesNotUpdateEtag_whenNil() {
        setupCacheExpired()

        let config = BaseDynamicConfig.default()
        mockNetworkClient.stubConfig(.success(config: config, eTag: nil, cacheControl: 3600))

        configLoader.loadDynamicConfig { _ in }

        XCTAssert(mockUserDefaults.eTag!.isEmpty)
    }

    func testLoadConfig_notModified_onlyUpdatesTimestamp() {
        setupCacheExpired()

        mockUserDefaults.configFetchTimestamp = 10
        mockNetworkClient.configResponse = .notModified

        configLoader.loadDynamicConfig { _ in }

        XCTAssertEqual(mockUserDefaults.configFetchTimestamp, mockTimeProvider.current)
        XCTAssertTrue(mockFileManager.savedFiles.isEmpty)
    }

    func testLoadConfig_error_doesNothing() {
        setupCacheExpired()

        mockUserDefaults.configFetchTimestamp = 10
        mockNetworkClient.configResponse = .error

        configLoader.loadDynamicConfig { _ in }

        XCTAssertEqual(mockUserDefaults.configFetchTimestamp, 10)
        XCTAssertTrue(mockFileManager.savedFiles.isEmpty)
    }

    func testLoadConfig_passesStoredEtag() {
        setupCacheExpired()
        mockUserDefaults.eTag = "old-etag"
        mockNetworkClient.configResponse = .notModified

        configLoader.loadDynamicConfig { _ in }

        XCTAssertEqual(mockNetworkClient.lastETag, "old-etag")
    }

    func testLoadConfig_skipsRefresh_whenCacheNotExpired() {
        mockUserDefaults.configFetchTimestamp = 1000
        mockUserDefaults.configCacheControl = 10_000
        mockTimeProvider.current = 2000

        configLoader.loadDynamicConfig { _ in }

        XCTAssertNil(mockNetworkClient.lastETag)
    }

    // MARK: - Helpers

    private func setupCacheExpired() {
        mockUserDefaults.configFetchTimestamp = 1000
        mockUserDefaults.configCacheControl = 100
        mockUserDefaults.eTag = ""
        mockTimeProvider.current = 2000
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
