//
//  UUIDProviderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import XCTest
@testable import MeasureSDK

final class UUIDProviderTests: XCTestCase {
    var uuidProvider: UUIDProvider!

    override func setUp() {
        super.setUp()
        uuidProvider = UUIDProvider()
    }

    override func tearDown() {
        uuidProvider = nil
        super.tearDown()
    }

    func testCreateIdReturnsValidUUID() {
        let id = uuidProvider.createId()
        print("id: \(id)")

        XCTAssertTrue(isValidUUID(id), "The generated ID should be a valid UUID string")
    }

    private func isValidUUID(_ string: String) -> Bool {
        // A UUID string should be in the format "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
        let uuidRegex = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        let predicate = NSPredicate(format: "SELF MATCHES %@", uuidRegex)
        return predicate.evaluate(with: string)
    }
}
