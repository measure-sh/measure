//
//  ClientInfoTests.swift
//  MeasureSDK
//
//  Created by Abhay Sood on 12/06/25.
//

import XCTest
@testable import Measure

final class ClientInfoTests: XCTestCase {
    
    private let validApiKey = "test-api-key"
    private let validApiUrl = "https://localhost:8080"
    private let invalidApiUrl = "%%%"

    func testDecode_withValidJson_decodesSuccessfully() throws {
        let json = """
        {
            "apiKey": "\(validApiKey)",
            "apiUrl": "\(validApiUrl)"
        }
        """
        let data = json.data(using: .utf8)!
        
        let clientInfo = try JSONDecoder().decode(ClientInfo.self, from: data)
        
        XCTAssertEqual(clientInfo.apiKey, validApiKey)
        XCTAssertEqual(clientInfo.apiUrl.absoluteString, validApiUrl)
    }

    func testDecode_missingApiKey_throwsError() {
        let json = """
        {
            "apiUrl": "\(validApiUrl)"
        }
        """
        let data = json.data(using: .utf8)!
        
        XCTAssertThrowsError(try JSONDecoder().decode(ClientInfo.self, from: data)) { error in
            XCTAssertTrue(error is DecodingError)
        }
    }

    func testDecode_missingApiUrl_throwsError() {
        let json = """
        {
            "apiKey": "\(validApiKey)"
        }
        """
        let data = json.data(using: .utf8)!
        
        XCTAssertThrowsError(try JSONDecoder().decode(ClientInfo.self, from: data)) { error in
            XCTAssertTrue(error is DecodingError)
        }
    }
}
