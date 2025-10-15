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
