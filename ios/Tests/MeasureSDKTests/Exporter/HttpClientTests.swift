//
//  HttpClientTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import XCTest
@testable import Measure

class HttpClientTests: XCTestCase {
    private var logger: MockLogger!
    private var configProvider: MockConfigProvider!
    private var client: BaseHttpClient!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        configProvider = MockConfigProvider()
        client = BaseHttpClient(logger: logger, configProvider: configProvider)
    }

    override func tearDown() {
        client = nil
        configProvider = nil
        logger = nil
        super.tearDown()
    }

    func testCreateRequest() {
        let url = URL(string: "https://example.com/api")!
        let method = HttpMethod.post
        let headers: [String: String] = ["Authorization": "Bearer token"]

        let request = client.createRequest(url: url, method: method, headers: headers)

        XCTAssertEqual(request.url, url)
        XCTAssertEqual(request.httpMethod, method.rawValue)
        XCTAssertEqual(request.timeoutInterval, configProvider.timeoutIntervalForRequest)
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "multipart/form-data; boundary=\(multipartBoundry)")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token")
    }

    func testCreateMultipartBody() {
        let multipartData: [MultipartData] = [
            .formField(name: "field1", value: Data("value1".utf8)),
            .formField(name: "field2", value: Data("value2".utf8))
        ]

        let body = client.createMultipartBody(multipartData)

        let bodyString = String(data: body, encoding: .utf8)

        // swiftlint:disable line_length
        let expectedBodyString = """
        --\(multipartBoundry)\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalue1\r\n--\(multipartBoundry)\r\nContent-Disposition: form-data; name="field2"\r\n\r\nvalue2\r\n--\(multipartBoundry)--\r\n
        """
        // swiftlint:enable line_length

        XCTAssertEqual(bodyString, expectedBodyString)
    }

    func testGetCustomHeader_notNilIfSet() {
        class CustomHeader: NSObject, MsrRequestHeadersProvider {
            func getRequestHeaders() -> NSDictionary {
                return ["key1": "value1", "key2": "value2"]
            }
        }
        configProvider = MockConfigProvider(requestHeadersProvider: CustomHeader())
        client = BaseHttpClient(logger: logger, configProvider: configProvider)
        let customHeader = client.getCustomHeaders()
        XCTAssertNotNil(customHeader)
        XCTAssertEqual(customHeader!["key1"], "value1")
        XCTAssertEqual(customHeader!["key2"], "value2")
    }

    func testGetCustomHeader_removeValuesIfKeyContainsReservedHeaders() {
        class CustomHeader: NSObject, MsrRequestHeadersProvider {
            func getRequestHeaders() -> NSDictionary {
                return ["key1": "value1", "key2": "value2", "Content-Type": "abc", "msr-req-id": "abc", "Authorization": "abc", "Content-Length": "abc"]
            }
        }
        configProvider = MockConfigProvider(requestHeadersProvider: CustomHeader())
        client = BaseHttpClient(logger: logger, configProvider: configProvider)
        let customHeader = client.getCustomHeaders()
        XCTAssertNotNil(customHeader)
        XCTAssertEqual(customHeader!.count, 2)
        XCTAssertEqual(customHeader!["key1"], "value1")
        XCTAssertEqual(customHeader!["key2"], "value2")
    }

    func testGetCustomHeader_returnsNil_whenProviderIsNil() {
        configProvider = MockConfigProvider(requestHeadersProvider: nil)
        client = BaseHttpClient(logger: logger, configProvider: configProvider)

        let customHeader = client.getCustomHeaders()
        XCTAssertNil(customHeader)
    }

    func testGetCustomHeader_caseInsensitiveDisallowFiltering() {
        class CustomHeader: NSObject, MsrRequestHeadersProvider {
            func getRequestHeaders() -> NSDictionary {
                return ["Authorization": "abc", "authorization": "xyz", "Key1": "value"]
            }
        }
        configProvider = MockConfigProvider(requestHeadersProvider: CustomHeader())
        client = BaseHttpClient(logger: logger, configProvider: configProvider)

        let customHeader = client.getCustomHeaders()
        XCTAssertNotNil(customHeader)
        XCTAssertEqual(customHeader!.count, 1)
        XCTAssertEqual(customHeader!["Key1"], "value")
        XCTAssertNil(customHeader!["Authorization"])
        XCTAssertNil(customHeader!["authorization"])
    }
}
