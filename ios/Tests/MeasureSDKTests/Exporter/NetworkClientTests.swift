//
//  NetworkClientTests.swift
//  MeasureSDKTests
//

import XCTest
@testable import Measure

final class NetworkClientTests: XCTestCase {
    private var mockHttpClient: MockHttpClient!
    private var networkClient: BaseNetworkClient!
    private var configBody: String!

    override func setUp() {
        super.setUp()

        mockHttpClient = MockHttpClient()
        networkClient = BaseNetworkClient(
            client: ClientInfo(apiKey: "test", apiUrl: "https://test.com"),
            httpClient: mockHttpClient,
            eventSerializer: EventSerializer(),
            systemFileManager: MockSystemFileManager(),
            logger: MockLogger()
        )

        let data = try? JSONEncoder().encode(BaseDynamicConfig())
        configBody = String(data: data ?? Data(), encoding: .utf8)
    }

    override func tearDown() {
        mockHttpClient = nil
        networkClient = nil
        configBody = nil
        super.tearDown()
    }

    func testGetConfig_success_parsesMaxAgeFromHeader() throws {
        mockHttpClient.sendResponse = .success(body: configBody, eTag: "etag", cacheControl: "max-age=600")

        let response = networkClient.getConfig(eTag: nil)

        guard case .success(_, _, let cacheControl) = response else {
            return XCTFail("Expected .success")
        }
        XCTAssertEqual(cacheControl, 600_000)
    }

    func testGetConfig_success_fallsBackToZero_whenHeaderMissing() throws {
        mockHttpClient.sendResponse = .success(body: configBody, eTag: "etag", cacheControl: nil)

        let response = networkClient.getConfig(eTag: nil)

        guard case .success(_, _, let cacheControl) = response else {
            return XCTFail("Expected .success")
        }
        XCTAssertEqual(cacheControl, 0)
    }

    func testGetConfig_success_fallsBackToZero_whenHeaderUnparseable() throws {
        mockHttpClient.sendResponse = .success(body: configBody, eTag: "etag", cacheControl: "no-cache")

        let response = networkClient.getConfig(eTag: nil)

        guard case .success(_, _, let cacheControl) = response else {
            return XCTFail("Expected .success")
        }
        XCTAssertEqual(cacheControl, 0)
    }

    func testGetConfig_notModified_parsesMaxAgeFromHeader() {
        mockHttpClient.sendResponse = .error(.clientError(responseCode: 304, body: nil, cacheControl: "max-age=600"))

        let response = networkClient.getConfig(eTag: "etag")

        guard case .notModified(let cacheControl) = response else {
            return XCTFail("Expected .notModified")
        }
        XCTAssertEqual(cacheControl, 600_000)
    }

    func testGetConfig_notModified_fallsBackToZero_whenHeaderMissing() {
        mockHttpClient.sendResponse = .error(.clientError(responseCode: 304, body: nil, cacheControl: nil))

        let response = networkClient.getConfig(eTag: "etag")

        guard case .notModified(let cacheControl) = response else {
            return XCTFail("Expected .notModified")
        }
        XCTAssertEqual(cacheControl, 0)
    }

    func testGetConfig_error_whenClientErrorIsNot304() {
        mockHttpClient.sendResponse = .error(.clientError(responseCode: 400, body: nil, cacheControl: nil))

        let response = networkClient.getConfig(eTag: nil)

        guard case .error = response else {
            return XCTFail("Expected .error")
        }
    }
}
