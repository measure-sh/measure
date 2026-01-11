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
    private let maxBodySize = 256 * 1024

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

    func test_validateAndTrimBody_nilBody() {
        let result = validator.validateAndTrimBody(nil, maxBodySizeBytes: Number(maxBodySize))
        XCTAssertNil(result, "Nil body should return nil")
    }

    func test_validateAndTrimBody_emptyBody() {
        let result = validator.validateAndTrimBody("", maxBodySizeBytes: Number(maxBodySize))
        XCTAssertNil(result, "Empty body should return nil")
    }

    func test_validateAndTrimBody_atLimit() {
        let bodyAtLimit = String(repeating: "a", count: maxBodySize)

        let result = validator.validateAndTrimBody(bodyAtLimit, maxBodySizeBytes: Number(maxBodySize))

        XCTAssertEqual(result, bodyAtLimit, "Body at the limit should not be truncated")
        XCTAssertEqual(result?.data(using: .utf8)?.count, maxBodySize, "Byte count should be max size")
    }

    func test_validateAndTrimBody_underLimit() {
        let bodyUnderLimit = String(repeating: "b", count: maxBodySize - 1)

        let result = validator.validateAndTrimBody(bodyUnderLimit, maxBodySizeBytes: Number(maxBodySize))

        XCTAssertEqual(result, bodyUnderLimit, "Body under the limit should not be truncated")
        XCTAssertEqual(result?.data(using: .utf8)?.count, maxBodySize - 1, "Byte count should be correct")
    }

    func test_validateAndTrimBody_overLimit_singleByte() {
        let bodyOverLimit = String(repeating: "c", count: maxBodySize + 1)
        let result = validator.validateAndTrimBody(bodyOverLimit, maxBodySizeBytes: Number(maxBodySize))

        XCTAssertNotNil(result, "Trimming an oversized body should not return nil")

        let truncationNotice = "\n... [Body truncated - exceeded 256KB limit]"
        XCTAssertTrue(result!.hasSuffix(truncationNotice), "Trimmed body must contain the truncation notice")

        let trimmedContent = result!.replacingOccurrences(of: truncationNotice, with: "")
        XCTAssertEqual(trimmedContent.data(using: .utf8)?.count, maxBodySize, "The pre-notice content size should be exactly maxBodySize")
    }

    func test_validateAndTrimBody_overLimit_multiByte() {
        let threeByteChar = "€"

        let baseBody = String(repeating: "a", count: maxBodySize - 1)
        let bodyWithMultiByteCutoff = baseBody + threeByteChar

        let result = validator.validateAndTrimBody(bodyWithMultiByteCutoff, maxBodySizeBytes: Number(maxBodySize))
        XCTAssertNotNil(result, "Trimming multi-byte body should not return nil")

        let truncationNotice = "\n... [Body truncated - exceeded 256KB limit]"
        let trimmedContent = result!.replacingOccurrences(of: truncationNotice, with: "")
        XCTAssertLessThanOrEqual(trimmedContent.data(using: .utf8)?.count ?? 0, maxBodySize, "The final trimmed content size must be less than or equal to maxBodySize")
        XCTAssertEqual(trimmedContent.suffix(1), "a", "The last character should be a valid, single-byte character from the original string.")
    }
}
