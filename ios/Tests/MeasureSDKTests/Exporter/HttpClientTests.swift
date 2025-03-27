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
    private var configProvider: ConfigProvider!
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

        let bodyString = String(data: body, encoding: .utf8) // swiftlint:disable:this non_optional_string_data_conversion

        // swiftlint:disable line_length
        let expectedBodyString = """
        --\(multipartBoundry)\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalue1\r\n--\(multipartBoundry)\r\nContent-Disposition: form-data; name="field2"\r\n\r\nvalue2\r\n--\(multipartBoundry)--\r\n
        """
        // swiftlint:enable line_length

        XCTAssertEqual(bodyString, expectedBodyString)
    }
}
