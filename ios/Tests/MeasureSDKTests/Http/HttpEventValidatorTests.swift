//
//  HttpEventValidatorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 27/03/25.
//

import XCTest
@testable import Measure

class HttpEventValidatorTests: XCTestCase {
    private var validator: HttpEventValidator!

    override func setUp() {
        super.setUp()
        validator = BaseHttpEventValidator()
    }

    func test_shouldTrackHttpEvent_whenContentTypeIsInAllowlist() {
        let result = validator.shouldTrackHttpEvent(["application/json"], contentType: "application/json", requestUrl: "https://example.com", allowedDomains: nil, ignoredDomains: nil)

        XCTAssertTrue(result, "Request should be tracked when content type is in allowlist")
    }

    func test_shouldNotTrackHttpEvent_whenContentTypeNotInAllowlist() {
        let result = validator.shouldTrackHttpEvent(["application/json"], contentType: "text/html", requestUrl: "https://example.com", allowedDomains: nil, ignoredDomains: nil)

        XCTAssertFalse(result, "Request should not be tracked when content type is not in allowlist")
    }

    func test_shouldTrackHttpEvent_whenURLMatchesAllowedDomains() {
        let result = validator.shouldTrackHttpEvent(nil, contentType: "application/json", requestUrl: "https://example.com", allowedDomains: ["example.com"], ignoredDomains: nil)

        XCTAssertTrue(result, "Request should be tracked when URL matches allowed domains")
    }

    func test_shouldNotTrackHttpEvent_whenURLDoesNotMatchAllowedDomains() {
        let result = validator.shouldTrackHttpEvent(nil, contentType: "application/json", requestUrl: "https://other.com", allowedDomains: ["example.com"], ignoredDomains: nil)

        XCTAssertFalse(result, "Request should not be tracked when URL does not match allowed domains")
    }

    func test_shouldNotTrackHttpEvent_whenURLIsInIgnoredDomains_andAllowedDomainsIsEmpty() {
        let result = validator.shouldTrackHttpEvent(nil, contentType: "application/json", requestUrl: "https://ignored.com", allowedDomains: [], ignoredDomains: ["ignored.com"])

        XCTAssertFalse(result, "Request should not be tracked when URL is in ignored domains and allowed domains is empty")
    }

    func test_shouldTrackHttpEvent_whenAllowedDomainsIsNonEmptyAndIgnoredDomainsExists() {
        let result = validator.shouldTrackHttpEvent(nil, contentType: "application/json", requestUrl: "https://example.com", allowedDomains: ["example.com"], ignoredDomains: ["ignored.com"])

        XCTAssertTrue(result, "Request should be tracked when allowed domains is non-empty even if ignored domains exist")
    }
}
