//
//  BaseConfigProviderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import XCTest
@testable import Measure

final class ConfigProviderTests: XCTestCase {
    private var provider: BaseConfigProvider!
    private var defaultConfig: Config!

    override func setUp() {
        super.setUp()
        defaultConfig = Config()
        provider = BaseConfigProvider(defaultConfig: defaultConfig)
    }

    override func tearDown() {
        provider = nil
        defaultConfig = nil
        super.tearDown()
    }

    func testShouldTrackHttpUrl_returnsTrueWhenNothingBlocked() {
        XCTAssertTrue(provider.shouldTrackHttpUrl(url: "https://api.example.com/data"))
    }

    func testShouldTrackHttpUrl_exactMatchBlocked() {
        var config = BaseDynamicConfig.default()
        config = BaseDynamicConfig(
            maxEventsInBatch: config.maxEventsInBatch,
            crashTimelineDurationSeconds: config.crashTimelineDurationSeconds,
            anrTimelineDurationSeconds: config.anrTimelineDurationSeconds,
            bugReportTimelineDurationSeconds: config.bugReportTimelineDurationSeconds,
            traceSamplingRate: config.traceSamplingRate,
            journeySamplingRate: config.journeySamplingRate,
            screenshotMaskLevel: config.screenshotMaskLevel,
            cpuUsageInterval: config.cpuUsageInterval,
            memoryUsageInterval: config.memoryUsageInterval,
            crashTakeScreenshot: config.crashTakeScreenshot,
            anrTakeScreenshot: config.anrTakeScreenshot,
            launchSamplingRate: config.launchSamplingRate,
            gestureClickTakeSnapshot: config.gestureClickTakeSnapshot,
            httpDisableEventForUrls: ["https://api.example.com/data"],
            httpTrackRequestForUrls: [],
            httpTrackResponseForUrls: [],
            httpBlockedHeaders: config.httpBlockedHeaders
        )

        provider.setDynamicConfig(config)

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://api.example.com/data"))
    }

    func testShouldTrackHttpUrl_wildcardMatch() {
        var config = BaseDynamicConfig.default()
        config = copy(config, disable: ["https://api.example.com/*"])

        provider.setDynamicConfig(config)

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://api.example.com/users"))
        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://api.example.com/data/123"))
        XCTAssertTrue(provider.shouldTrackHttpUrl(url: "https://other.example.com/data"))
    }

    func testWildcardInMiddle() {
        provider.setDynamicConfig(copy(.default(), disable: ["https://api.example.com/*/users"]))

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://api.example.com/data/users"))
        XCTAssertTrue(provider.shouldTrackHttpUrl(url: "https://api.example.com/data/nomatch"))
    }

    func testMultipleWildcardPatterns() {
        provider.setDynamicConfig(copy(.default(), disable: [
            "https://analytics.example.com/*",
            "https://tracking.example.com/*"
        ]))

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://analytics.example.com/event"))
        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://tracking.example.com/ping"))
        XCTAssertTrue(provider.shouldTrackHttpUrl(url: "https://api.example.com/data"))
    }

    func testShouldTrackHttpBody_returnsFalseWhenEmpty() {
        XCTAssertFalse(provider.shouldTrackHttpBody(url: "https://api.example.com/data", contentType: nil))
    }

    func testRequestBodyMatch() {
        provider.setDynamicConfig(copy(.default(), request: ["https://api.example.com/*"]))

        XCTAssertTrue(provider.shouldTrackHttpBody(url: "https://api.example.com/users", contentType: nil))
        XCTAssertFalse(provider.shouldTrackHttpBody(url: "https://other.example.com/data", contentType: nil))
    }

    func testResponseBodyMatch() {
        provider.setDynamicConfig(copy(.default(), response: ["https://api.example.com/*"]))

        XCTAssertTrue(provider.shouldTrackHttpBody(url: "https://api.example.com/users", contentType: nil))
        XCTAssertFalse(provider.shouldTrackHttpBody(url: "https://other.example.com/data", contentType: nil))
    }

    func testRequestAndResponseIndependent() {
        provider.setDynamicConfig(copy(.default(),
                                       request: ["https://request.example.com/*"],
                                       response: ["https://response.example.com/*"]))

        XCTAssertTrue(provider.shouldTrackHttpBody(url: "https://request.example.com/data", contentType: nil))
        XCTAssertFalse(provider.shouldTrackHttpBody(url: "https://other.example.com/data", contentType: nil))
    }

    func testDefaultBlockedHeaders() {
        ["Authorization", "Cookie", "Set-Cookie", "Proxy-Authorization", "WWW-Authenticate", "X-Api-Key"].forEach {
            XCTAssertFalse(provider.shouldTrackHttpHeader(key: $0))
        }
    }

    func testHeaderComparisonCaseInsensitive() {
        XCTAssertFalse(provider.shouldTrackHttpHeader(key: "authorization"))
    }

    func testDynamicBlockedHeader() {
        provider.setDynamicConfig(copy(.default(), blockedHeaders: ["X-Custom-Header"]))

        XCTAssertFalse(provider.shouldTrackHttpHeader(key: "X-Custom-Header"))
    }

    func testSetMeasureUrlBlocksIt() {
        let measureUrl = "https://measure.sh/api/v1"

        provider.setMeasureUrl(url: measureUrl)

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: measureUrl))
    }

    func testMeasureUrlPreservedAfterDynamicConfig() {
        let measureUrl = "https://measure.sh/api/v1"
        provider.setMeasureUrl(url: measureUrl)

        provider.setDynamicConfig(copy(.default(), disable: ["https://analytics.example.com/*"]))

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: measureUrl))
        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://analytics.example.com/event"))
    }

    func testSetDynamicConfigUpdatesValues() {
        provider.setDynamicConfig(copy(.default(),
                                       traceSamplingRate: 0.5,
                                       crashTakeScreenshot: false,
                                       cpuUsageInterval: 5000))

        XCTAssertEqual(provider.traceSamplingRate, 0.5)
        XCTAssertFalse(provider.crashTakeScreenshot)
        XCTAssertEqual(provider.cpuUsageInterval, 5000)
    }

    func testWildcardAtBeginning() {
        provider.setDynamicConfig(copy(.default(), disable: ["*/api/v1/health"]))

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://example.com/api/v1/health"))
        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://other.com/api/v1/health"))
    }

    func testWildcardInMiddleHost() {
        provider.setDynamicConfig(copy(.default(), disable: ["https://*/api/health"]))

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://example.com/api/health"))
    }

    func testRegexCharactersEscaped() {
        provider.setDynamicConfig(copy(.default(),
                                       disable: ["https://api.example.com/path?query=value"]))

        XCTAssertFalse(provider.shouldTrackHttpUrl(url: "https://api.example.com/path?query=value"))
        XCTAssertTrue(provider.shouldTrackHttpUrl(url: "https://api.example.com/pathquery=value"))
    }

    func testShouldTrackHttpUrl_blocksDomainFromDefaultBlocklist() {
        provider = BaseConfigProvider(defaultConfig: defaultConfig)

        XCTAssertFalse(
            provider.shouldTrackHttpUrl(
                url: "https://storage.googleapis.com/msr/file.svg"
            )
        )
    }

    func testShouldTrackHttpUrl_domainBlocklistIsCaseInsensitive() {
        provider = BaseConfigProvider(defaultConfig: defaultConfig)

        XCTAssertFalse(
            provider.shouldTrackHttpUrl(
                url: "https://STORAGE.GOOGLEAPIS.COM/file"
            )
        )
    }

    func testShouldTrackHttpUrl_doesNotBlockOtherDomains() {
        provider = BaseConfigProvider(defaultConfig: defaultConfig)

        XCTAssertTrue(
            provider.shouldTrackHttpUrl(
                url: "https://api.example.com/data"
            )
        )
    }

    func testShouldTrackHttpUrl_malformedUrlReturnsTrue() {
        provider = BaseConfigProvider(defaultConfig: defaultConfig)

        XCTAssertTrue(provider.shouldTrackHttpUrl(url: "not a url"))
    }

    private func copy(
        _ base: BaseDynamicConfig,
        disable: [String] = [],
        request: [String] = [],
        response: [String] = [],
        blockedHeaders: [String]? = nil,
        traceSamplingRate: Float? = nil,
        crashTakeScreenshot: Bool? = nil,
        cpuUsageInterval: Number? = nil
    ) -> BaseDynamicConfig {
        BaseDynamicConfig(
            maxEventsInBatch: base.maxEventsInBatch,
            crashTimelineDurationSeconds: base.crashTimelineDurationSeconds,
            anrTimelineDurationSeconds: base.anrTimelineDurationSeconds,
            bugReportTimelineDurationSeconds: base.bugReportTimelineDurationSeconds,
            traceSamplingRate: traceSamplingRate ?? base.traceSamplingRate,
            journeySamplingRate: base.journeySamplingRate,
            screenshotMaskLevel: base.screenshotMaskLevel,
            cpuUsageInterval: cpuUsageInterval ?? base.cpuUsageInterval,
            memoryUsageInterval: base.memoryUsageInterval,
            crashTakeScreenshot: crashTakeScreenshot ?? base.crashTakeScreenshot,
            anrTakeScreenshot: base.anrTakeScreenshot,
            launchSamplingRate: base.launchSamplingRate,
            gestureClickTakeSnapshot: base.gestureClickTakeSnapshot,
            httpDisableEventForUrls: disable,
            httpTrackRequestForUrls: request,
            httpTrackResponseForUrls: response,
            httpBlockedHeaders: blockedHeaders ?? base.httpBlockedHeaders
        )
    }
}
