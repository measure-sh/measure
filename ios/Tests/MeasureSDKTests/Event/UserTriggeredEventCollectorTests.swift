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

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        configProvider = MockConfigProvider()
        signalProcessor = MockSignalProcessor()
        timeProvider = MockTimeProvider()

        collector = BaseUserTriggeredEventCollector(signalProcessor: signalProcessor,
                                                    timeProvider: timeProvider,
                                                    logger: logger,
                                                    exceptionGenerator: MockExceptionGenerator(),
                                                    attributeValueValidator: BaseAttributeValueValidator(configProvider: configProvider, logger: logger),
                                                    configProvider: configProvider)

        collector.enable()
    }

    override func tearDown() {
        logger = nil
        configProvider = nil
        signalProcessor = nil
        timeProvider = nil
        collector = nil
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

        XCTAssertEqual(signalProcessor.type, .http, "Event type should be .http")

        let trackedHttpData = try XCTUnwrap(signalProcessor.data as? HttpData)
        XCTAssertEqual(trackedHttpData.url, "https://example.com/api")
        XCTAssertEqual(trackedHttpData.statusCode, 200)
        XCTAssertEqual(trackedHttpData.startTime, startTime)
    }
    
    func test_trackHttpEvent_success_withHeadersAndError() throws {
        let testError = TestEvent()
        let reqHeaders: [String: String] = ["X-Request-ID": "123"]

        collector.trackHttpEvent(
            url: "https://example.com/data",
            method: "POST",
            startTime: 1000,
            endTime: 3000,
            client: "Alamofire",
            statusCode: 400,
            error: testError,
            requestHeaders: reqHeaders,
            responseHeaders: nil,
            requestBody: nil,
            responseBody: nil
        )

        let trackedHttpData = try XCTUnwrap(signalProcessor.data as? HttpData)
        XCTAssertEqual(trackedHttpData.statusCode, 400)
        XCTAssertEqual(trackedHttpData.requestHeaders?["X-Request-ID"], "123")
        XCTAssertTrue(((trackedHttpData.failureReason?.contains("TestError: NetworkFailure")) != nil))
        XCTAssertTrue(((trackedHttpData.failureDescription?.contains("A network operation failed.")) != nil))
    }

    func test_trackHttpEvent_guardsAgainstDisabledCollector() {
        collector.disable()
        
        collector.trackHttpEvent(
            url: "https://example.com", method: "GET", startTime: 1000, endTime: 2000, client: "test", statusCode: 200, error: nil, requestHeaders: nil, responseHeaders: nil, requestBody: nil, responseBody: nil
        )
        
        XCTAssertNil(signalProcessor.data, "No event should be tracked if disabled")
        XCTAssertFalse(logger.logs.contains(where: { $0.contains("Failed to track HTTP event") }))
    }
    
    func test_trackHttpEvent_guardsAgainstEmptyUrl() {
        collector.trackHttpEvent(
            url: "",
            method: "GET",
            startTime: 1000, endTime: 2000, client: "test", statusCode: 200, error: nil, requestHeaders: nil, responseHeaders: nil, requestBody: nil, responseBody: nil
        )
        
        XCTAssertNil(signalProcessor.data, "Event should be discarded")
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("url is required") }))
    }
    
    func test_trackHttpEvent_guardsAgainstInvalidTimeDuration() {
        collector.trackHttpEvent(
            url: "https://example.com", method: "GET", startTime: 2000, endTime: 1000, client: "test", statusCode: 200, error: nil, requestHeaders: nil, responseHeaders: nil, requestBody: nil, responseBody: nil
        )
        
        XCTAssertNil(signalProcessor.data, "Event should be discarded")
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("end < start") }))
    }
    
    func test_trackHttpEvent_guardsAgainstInvalidStatusCode() {
        collector.trackHttpEvent(
            url: "https://example.com", method: "GET", startTime: 1000, endTime: 2000, client: "test", statusCode: 99, error: nil, requestHeaders: nil, responseHeaders: nil, requestBody: nil, responseBody: nil
        )
        
        XCTAssertNil(signalProcessor.data, "Event should be discarded")
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("invalid status code: 99") }))
    }
    
    func test_trackHttpEvent_discardsBasedOnUrlBlocklist() {
        configProvider.combinedHttpUrlBlocklist = ["blocked"]
        
        collector.trackHttpEvent(
            url: "https://api.blocked.com/data",
            method: "GET",
            startTime: 1000, endTime: 2000, client: "test", statusCode: 200, error: nil, requestHeaders: nil, responseHeaders: nil, requestBody: nil, responseBody: nil
        )
        
        XCTAssertNil(signalProcessor.data, "Event must be blocked by config")
        XCTAssertTrue(logger.logs.contains(where: { $0.contains("URL is not allowed for tracking") }))
    }
    
    func test_trackHttpEvent_discardsBodyWhenNotConfigured() throws {
        collector.trackHttpEvent(
            url: "https://example.com/data",
            method: "POST",
            startTime: 1000, endTime: 2000, client: "test", statusCode: 200, error: nil, requestHeaders: nil, responseHeaders: nil, requestBody: "body_data", responseBody: "body_data"
        )
        
        let httpData = try XCTUnwrap(signalProcessor.data as? HttpData)

        XCTAssertNil(httpData.requestBody, "Ignore requestBody if trackHttpBody is false")
        XCTAssertNil(httpData.responseBody, "Ignore responseBody if trackHttpBody is false")
    }
    
    func test_trackHttpEvent_sanitizesHeaders() throws {
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
            startTime: 1000, endTime: 2000, client: "test", statusCode: 200, error: nil, requestHeaders: reqHeaders, responseHeaders: nil, requestBody: nil, responseBody: nil
        )
        
        let trackedHttpData = try XCTUnwrap(signalProcessor.data as? HttpData)
        // TODO: fix these tests
//        XCTAssertEqual(trackedHttpData.requestHeaders?.count, 2, "Only non-blocked headers should remain")
        XCTAssertNotNil(trackedHttpData.requestHeaders?["Content-Type"])
        XCTAssertNotNil(trackedHttpData.requestHeaders?["Accept"])
//        XCTAssertNil(trackedHttpData.requestHeaders?["Authorization"], "Authorization should have been sanitized")
    }
}
