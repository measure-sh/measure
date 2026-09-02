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
    private var measureDispatchQueue: MockMeasureDispatchQueue!

    override func setUp() {
        super.setUp()

        mockNetworkClient = MockNetworkClient()
        mockUserDefaults = MockUserDefaultStorage()
        mockFileManager = MockSystemFileManager()
        mockTimeProvider = MockTimeProvider()
        measureDispatchQueue = MockMeasureDispatchQueue()

        configLoader = BaseConfigLoader(
            userDefaultStorage: mockUserDefaults,
            fileManager: mockFileManager,
            networkClient: mockNetworkClient,
            timeProvider: mockTimeProvider,
            logger: MockLogger(),
            measureDispatchQueue: measureDispatchQueue
        )
    }

    override func tearDown() {
        configLoader = nil
        mockNetworkClient = nil
        mockUserDefaults = nil
        mockFileManager = nil
        mockTimeProvider = nil
        measureDispatchQueue = nil
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
        let configKey = "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.dynamicConfigFolderName)/\(ConfigFileConstants.fileName)"
        mockFileManager.savedFiles[configKey] = Data("{ invalid".utf8)

        let exp = expectation(description: "loaded")

        configLoader.loadDynamicConfig { config in
            XCTAssertNotNil(config)
            exp.fulfill()
        }

        wait(for: [exp], timeout: 1)
    }

    func testLoadDynamicConfig_returnsConfig_whenValidFileExists() throws {
        let expected = BaseDynamicConfig()
        let data = try JSONEncoder().encode(expected)

        let configKey = "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.dynamicConfigFolderName)/\(ConfigFileConstants.fileName)"
        mockFileManager.savedFiles[configKey] = data

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

    // A config file written by an SDK released before the crash to error rename holds only
    // the crash_* keys. Their values must carry over instead of reverting to defaults.
    func testLoadDynamicConfig_readsLegacyCrashKeys_whenErrorKeysAbsent() throws {
        let legacyOnly = """
        { "crash_timeline_duration": 111, "crash_take_screenshot": false }
        """

        let config = try loadConfig(fromJson: legacyOnly)

        XCTAssertEqual(config?.errorReplayDurationSeconds, 111)
        XCTAssertEqual(config?.errorFatalTakeScreenshot, false)
    }

    func testLoadDynamicConfig_prefersErrorKeys_whenBothPresent() throws {
        let bothFamilies = """
        {
            "error_replay_duration": 222, "error_fatal_take_screenshot": true,
            "crash_timeline_duration": 111, "crash_take_screenshot": false
        }
        """

        let config = try loadConfig(fromJson: bothFamilies)

        XCTAssertEqual(config?.errorReplayDurationSeconds, 222)
        XCTAssertEqual(config?.errorFatalTakeScreenshot, true)
    }

    func testEncode_writesLegacyCrashKeys_alongsideErrorKeys() throws {
        let config = BaseDynamicConfig(errorReplayDurationSeconds: 111, errorFatalTakeScreenshot: false)

        let data = try JSONEncoder().encode(config)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(json["error_replay_duration"] as? Int, 111)
        XCTAssertEqual(json["crash_timeline_duration"] as? Int, 111)
        XCTAssertEqual(json["error_fatal_take_screenshot"] as? Bool, false)
        XCTAssertEqual(json["crash_take_screenshot"] as? Bool, false)
    }

    // MARK: - Cache + network

    func testLoadConfig_fetchesConfig_whenCacheExpired() {
        setupCacheExpired()

        mockNetworkClient.configResponse = .notModified(cacheControl: 0)

        configLoader.loadDynamicConfig { _ in }

        XCTAssertEqual(mockNetworkClient.lastETag, "")
    }

    func testLoadConfig_success_updatesFileAndPrefs() throws {
        setupCacheExpired()

        let config = BaseDynamicConfig()
        let eTag = "new-etag"
        let cache: Number = 3600

        mockNetworkClient.stubConfig(.success(config: config, eTag: eTag, cacheControl: cache))

        configLoader.loadDynamicConfig { _ in }

        let key = "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.dynamicConfigFolderName)/\(ConfigFileConstants.fileName)"
        let saved = try XCTUnwrap(mockFileManager.savedFiles[key])
        let decoded = try JSONDecoder().decode(BaseDynamicConfig.self, from: saved)

        assertConfigsEqual(decoded, config)

        XCTAssertEqual(mockUserDefaults.configFetchTimestamp, mockTimeProvider.current)
        XCTAssertEqual(mockUserDefaults.configCacheControl, cache)
        XCTAssertEqual(mockUserDefaults.eTag, eTag)
    }

    func testLoadConfig_doesNotUpdateEtag_whenNil() {
        setupCacheExpired()

        let config = BaseDynamicConfig()
        mockNetworkClient.stubConfig(.success(config: config, eTag: nil, cacheControl: 3600))

        configLoader.loadDynamicConfig { _ in }

        XCTAssert(mockUserDefaults.eTag!.isEmpty)
    }

    func testLoadConfig_notModified_withoutCacheControl_onlyUpdatesTimestamp() {
        setupCacheExpired()

        mockUserDefaults.configFetchTimestamp = 10
        let existingCacheControl = mockUserDefaults.configCacheControl
        mockNetworkClient.configResponse = .notModified(cacheControl: 0)

        configLoader.loadDynamicConfig { _ in }

        XCTAssertEqual(mockUserDefaults.configFetchTimestamp, mockTimeProvider.current)
        XCTAssertEqual(mockUserDefaults.configCacheControl, existingCacheControl)
        XCTAssertTrue(mockFileManager.savedFiles.isEmpty)
    }

    func testLoadConfig_notModified_withCacheControl_updatesWindow() {
        setupCacheExpired()

        mockUserDefaults.configFetchTimestamp = 10
        mockNetworkClient.configResponse = .notModified(cacheControl: 3600)

        configLoader.loadDynamicConfig { _ in }

        XCTAssertEqual(mockUserDefaults.configFetchTimestamp, mockTimeProvider.current)
        XCTAssertEqual(mockUserDefaults.configCacheControl, 3600)
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
        mockNetworkClient.configResponse = .notModified(cacheControl: 0)

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

    // MARK: - Folder structure

    func test_saveConfigToDisk_savesUnderDynamicConfigSubfolder() {
        setupCacheExpired()
        mockNetworkClient.stubConfig(.success(config: BaseDynamicConfig(), eTag: "etag", cacheControl: 3600))

        configLoader.loadDynamicConfig { _ in }

        let expectedKey = "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.dynamicConfigFolderName)/\(ConfigFileConstants.fileName)"
        XCTAssertNotNil(mockFileManager.savedFiles[expectedKey])
    }

    func test_loadConfigFromDisk_readsFromDynamicConfigSubfolder() throws {
        let expected = BaseDynamicConfig()
        let data = try JSONEncoder().encode(expected)
        let configKey = "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.dynamicConfigFolderName)/\(ConfigFileConstants.fileName)"
        mockFileManager.savedFiles[configKey] = data
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
        XCTAssertEqual(actual.errorReplayDurationSeconds, expected.errorReplayDurationSeconds, file: file, line: line)
        XCTAssertEqual(actual.anrTimelineDurationSeconds, expected.anrTimelineDurationSeconds, file: file, line: line)
        XCTAssertEqual(actual.bugReportTimelineDurationSeconds, expected.bugReportTimelineDurationSeconds, file: file, line: line)
        XCTAssertEqual(actual.traceSamplingRate, expected.traceSamplingRate, file: file, line: line)
        XCTAssertEqual(actual.journeySamplingRate, expected.journeySamplingRate, file: file, line: line)
        XCTAssertEqual(actual.screenshotMaskLevel, expected.screenshotMaskLevel, file: file, line: line)
        XCTAssertEqual(actual.cpuUsageInterval, expected.cpuUsageInterval, file: file, line: line)
        XCTAssertEqual(actual.memoryUsageInterval, expected.memoryUsageInterval, file: file, line: line)
        XCTAssertEqual(actual.errorFatalTakeScreenshot, expected.errorFatalTakeScreenshot, file: file, line: line)
        XCTAssertEqual(actual.anrTakeScreenshot, expected.anrTakeScreenshot, file: file, line: line)
        XCTAssertEqual(actual.launchSamplingRate, expected.launchSamplingRate, file: file, line: line)
        XCTAssertEqual(actual.gestureClickTakeSnapshot, expected.gestureClickTakeSnapshot, file: file, line: line)
        XCTAssertEqual(actual.httpDisableEventForUrls, expected.httpDisableEventForUrls, file: file, line: line)
        XCTAssertEqual(actual.httpTrackRequestForUrls, expected.httpTrackRequestForUrls, file: file, line: line)
        XCTAssertEqual(actual.httpTrackResponseForUrls, expected.httpTrackResponseForUrls, file: file, line: line)
        XCTAssertEqual(actual.httpBlockedHeaders, expected.httpBlockedHeaders, file: file, line: line)
    }

    /// Loads `json` as the config already on disk, with the cache still valid so no fetch happens.
    private func loadConfig(fromJson json: String) throws -> BaseDynamicConfig? {
        let configKey = "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.dynamicConfigFolderName)/\(ConfigFileConstants.fileName)"
        mockFileManager.savedFiles[configKey] = Data(json.utf8)

        mockUserDefaults.configFetchTimestamp = 1000
        mockUserDefaults.configCacheControl = 10_000
        mockTimeProvider.current = 2000

        var loaded: BaseDynamicConfig?
        let exp = expectation(description: "loaded")
        configLoader.loadDynamicConfig { config in
            loaded = config as? BaseDynamicConfig
            exp.fulfill()
        }
        wait(for: [exp], timeout: 1)

        return loaded
    }
}
