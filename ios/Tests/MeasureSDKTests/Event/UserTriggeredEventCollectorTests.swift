//
//  UserTriggeredEventCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 17/10/25.
//

@testable import Measure
import XCTest

struct TestEvent: Error {}

final class UserTriggeredEventCollectorTests: XCTestCase {
    var logger: MockLogger!
    var configProvider: MockConfigProvider!
    var signalProcessor: MockSignalProcessor!
    var timeProvider: MockTimeProvider!
    var collector: BaseUserTriggeredEventCollector!
    var sessionManager: MockSessionManager!
    var signalSampler: MockSignalSampler!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        configProvider = MockConfigProvider()
        signalProcessor = MockSignalProcessor()
        timeProvider = MockTimeProvider()
        sessionManager = MockSessionManager()
        signalSampler = MockSignalSampler()

        collector = BaseUserTriggeredEventCollector(
            signalProcessor: signalProcessor,
            timeProvider: timeProvider,
            logger: logger,
            exceptionGenerator: MockExceptionGenerator(),
            attributeValueValidator: BaseAttributeValueValidator(configProvider: configProvider, logger: logger),
            configProvider: configProvider,
            sessionManager: sessionManager,
            signalSampler: signalSampler
        )

        collector.enable()
    }

    override func tearDown() {
        logger = nil
        configProvider = nil
        signalProcessor = nil
        timeProvider = nil
        collector = nil
        sessionManager = nil
        signalSampler = nil
        super.tearDown()
    }

    func test_trackHttpEvent_success_minimal() throws {
        let startTime: UInt64 = 1000
        let endTime: UInt64 = 2000

        collector.trackHttpEvent(
            url: "https://example.com/api",
            method: "GET",
            startTime: startTime,
            endTime: endTime,
            client: "URLSession",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        XCTAssertEqual(signalProcessor.type, .http)

        let trackedHttpData = try XCTUnwrap(signalProcessor.data as? HttpData)
        XCTAssertEqual(trackedHttpData.url, "https://example.com/api")
        XCTAssertEqual(trackedHttpData.statusCode, 200)
        XCTAssertEqual(trackedHttpData.startTime, startTime)
    }

    func test_trackHttpEvent_guardsAgainstDisabledCollector() {
        collector.disable()

        collector.trackHttpEvent(
            url: "https://example.com",
            method: "GET",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        XCTAssertNil(signalProcessor.data)
    }

    func test_trackHttpEvent_guardsAgainstEmptyUrl() {
        collector.trackHttpEvent(
            url: "",
            method: "GET",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("url is required") }))
    }

    func test_trackHttpEvent_guardsAgainstInvalidTimeDuration() {
        collector.trackHttpEvent(
            url: "https://example.com",
            method: "GET",
            startTime: 2000,
            endTime: 1000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("end < start") }))
    }

    func test_trackHttpEvent_zeroTimestamp_isDiscarded() {
        collector.trackHttpEvent(
            url: "https://example.com",
            method: "GET",
            startTime: 0,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("invalid start or end time") }))
    }

    func test_trackHttpEvent_invalidStatusCode_isDiscarded() {
        collector.trackHttpEvent(
            url: "https://example.com",
            method: "GET",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 99,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("invalid status code") }))
    }

    func test_trackHttpEvent_invalidMethod_isDiscarded() {
        collector.trackHttpEvent(
            url: "https://example.com",
            method: "TRACE",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("invalid method") }))
    }

    func test_trackHttpEvent_discardsBasedOnUrlBlocklist() {
        configProvider.combinedHttpUrlBlocklist = ["blocked"]

        collector.trackHttpEvent(
            url: "https://api.blocked.com/data",
            method: "GET",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("URL is not allowed for tracking") }))
    }

    func test_trackHttpEvent_discardsBodyWhenNotConfigured() throws {
        collector.trackHttpEvent(
            url: "https://example.com/data",
            method: "POST",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: nil,
            requestBody: "body_data",
            responseBody: "body_data"
        )

        let httpData = try XCTUnwrap(signalProcessor.data as? HttpData)
        XCTAssertNil(httpData.requestBody)
        XCTAssertNil(httpData.responseBody)
    }

    func test_trackHttpEvent_sanitizesRequestHeaders() throws {
        configProvider.combinedHttpHeadersBlocklist = ["Authorization", "Custom-Secret"]

        let reqHeaders: [String: String] = [
            "Content-Type": "application/json",
            "Authorization": "Bearer 12345",
            "Custom-Secret": "hidden",
            "Accept": "*/*"
        ]

        collector.trackHttpEvent(
            url: "https://example.com/data",
            method: "GET",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: reqHeaders,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        let data = try XCTUnwrap(signalProcessor.data as? HttpData)

        XCTAssertEqual(data.requestHeaders?.count, 2)
        XCTAssertNotNil(data.requestHeaders?["Content-Type"])
        XCTAssertNotNil(data.requestHeaders?["Accept"])
        XCTAssertNil(data.requestHeaders?["Authorization"])
        XCTAssertNil(data.requestHeaders?["Custom-Secret"])
    }

    func test_trackHttpEvent_allHeadersBlocked_resultsInNilHeaders() throws {
        configProvider.combinedHttpHeadersBlocklist = ["A", "B"]

        let headers = ["A": "1", "B": "2"]

        collector.trackHttpEvent(
            url: "https://example.com",
            method: "GET",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: headers,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        let data = try XCTUnwrap(signalProcessor.data as? HttpData)
        XCTAssertNil(data.requestHeaders)
    }

    func test_trackHttpEvent_sanitizesResponseHeaders() throws {
        configProvider.combinedHttpHeadersBlocklist = ["Secret"]

        let responseHeaders = [
            "OK": "1",
            "Secret": "nope"
        ]

        collector.trackHttpEvent(
            url: "https://example.com",
            method: "GET",
            startTime: 1000,
            endTime: 2000,
            client: "test",
            statusCode: 200,
            error: nil,
            requestHeaders: nil,
            responseHeaders: responseHeaders,
            requestBody: nil,
            responseBody: nil
        )

        let data = try XCTUnwrap(signalProcessor.data as? HttpData)

        XCTAssertEqual(data.responseHeaders?.count, 1)
        XCTAssertNotNil(data.responseHeaders?["OK"])
        XCTAssertNil(data.responseHeaders?["Secret"])
    }
}
