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
}
