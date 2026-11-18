//
//  URLSessionTaskInterceptorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 29/07/26.
//

import XCTest
@testable import Measure

class URLSessionTaskInterceptorTests: XCTestCase {
    private var interceptor: URLSessionTaskInterceptor!

    override func setUp() {
        super.setUp()
        interceptor = URLSessionTaskInterceptor.shared
    }

    func test_isHttpUrl_whenSchemeIsHttp() {
        XCTAssertTrue(interceptor.isHttpUrl("http://example.com/path"), "http requests should be tracked")
    }

    func test_isHttpUrl_whenSchemeIsHttps() {
        XCTAssertTrue(interceptor.isHttpUrl("https://example.com/path?query=1"), "https requests should be tracked")
    }

    func test_isHttpUrl_whenSchemeIsUppercase() {
        XCTAssertTrue(interceptor.isHttpUrl("HTTPS://Example.com"), "Scheme comparison should be case insensitive")
    }

    func test_isHttpUrl_whenUrlIsTheSwizzlerProbe() {
        XCTAssertFalse(interceptor.isHttpUrl("msr"), "A url with no scheme should not be tracked")
    }

    func test_isHttpUrl_whenSchemeIsMissing() {
        XCTAssertFalse(interceptor.isHttpUrl("//example.com/path"), "A protocol relative url should not be tracked")
    }

    func test_isHttpUrl_whenHostIsMissing() {
        XCTAssertFalse(interceptor.isHttpUrl("http://"), "A url with no host should not be tracked")
    }

    func test_isHttpUrl_whenSchemeIsFile() {
        XCTAssertFalse(interceptor.isHttpUrl("file:///var/tmp/image.png"), "file requests should not be tracked")
    }

    func test_isHttpUrl_whenSchemeIsWebSocket() {
        XCTAssertFalse(interceptor.isHttpUrl("ws://example.com/socket"), "ws requests should not be tracked")
        XCTAssertFalse(interceptor.isHttpUrl("wss://example.com/socket"), "wss requests should not be tracked")
    }

    func test_isHttpUrl_whenSchemeIsCustom() {
        XCTAssertFalse(interceptor.isHttpUrl("myapp://example.com/path"), "Custom scheme requests should not be tracked")
    }

    func test_isHttpUrl_whenSchemeIsData() {
        XCTAssertFalse(interceptor.isHttpUrl("data:text/plain;base64,bWVhc3VyZQ=="), "data urls should not be tracked")
    }

    func test_isHttpUrl_whenUrlIsEmpty() {
        XCTAssertFalse(interceptor.isHttpUrl(""), "An empty url should not be tracked")
    }

    func test_shouldRecordEvent_recordsFirstRequest() {
        XCTAssertTrue(interceptor.shouldRecordEvent(method: "get", url: uniqueUrl(), currentTime: 1000))
    }

    func test_shouldRecordEvent_dropsDuplicateWithinWindow() {
        let url = uniqueUrl()

        XCTAssertTrue(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 1000))
        XCTAssertFalse(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 1299))
    }

    func test_shouldRecordEvent_recordsDuplicateAfterWindow() {
        let url = uniqueUrl()

        XCTAssertTrue(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 1000))
        XCTAssertTrue(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 1300))
    }

    func test_shouldRecordEvent_recordsSameUrlWithDifferentMethod() {
        let url = uniqueUrl()

        XCTAssertTrue(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 1000))
        XCTAssertTrue(interceptor.shouldRecordEvent(method: "post", url: url, currentTime: 1000))
    }

    func test_shouldRecordEvent_dropsDuplicateWithEarlierTime() {
        let url = uniqueUrl()

        XCTAssertTrue(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 1000))
        XCTAssertFalse(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 999))
    }

    func test_shouldRecordEvent_keepsLaterEntryWhenAnotherUrlHasEarlierTime() {
        let url = uniqueUrl()

        XCTAssertTrue(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 1000))
        XCTAssertTrue(interceptor.shouldRecordEvent(method: "get", url: uniqueUrl(), currentTime: 999))
        XCTAssertFalse(interceptor.shouldRecordEvent(method: "get", url: url, currentTime: 1001))
    }

    func test_shouldRecordEvent_recordsIncreasingTimesWindowApartForOutOfOrderCompletions() {
        var generator = SeededGenerator(seed: 5002)
        let urls = (0..<3).map { _ in uniqueUrl() }
        let maxReorderMs: UInt64 = 5
        var recordedTimes: [String: [UInt64]] = [:]

        var completions: [(url: String, time: UInt64)] = []
        var time: UInt64 = 1_000_000
        for _ in 0..<5000 {
            time += UInt64.random(in: 0...20, using: &generator)
            completions.append((urls.randomElement(using: &generator)!, time))
        }
        for index in completions.indices.dropFirst() where Bool.random(using: &generator) {
            if completions[index - 1].time + maxReorderMs >= completions[index].time {
                completions.swapAt(index - 1, index)
            }
        }

        for completion in completions where interceptor.shouldRecordEvent(method: "get", url: completion.url, currentTime: completion.time) {
            recordedTimes[completion.url, default: []].append(completion.time)
        }

        for times in recordedTimes.values {
            for (previous, next) in zip(times, times.dropFirst()) {
                XCTAssertGreaterThan(next, previous)
                XCTAssertGreaterThanOrEqual(next - previous, 300 - maxReorderMs)
            }
        }
    }

    private func uniqueUrl() -> String {
        "https://example.com/\(UUID().uuidString)"
    }
}
