//
//  UserAttributeProcessorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import XCTest
@testable import MeasureSDK

final class UserAttributeProcessorTests: XCTestCase {
    private var userDefaultStorage: MockUserDefaultStorage!
    private var userAttributeProcessor: UserAttributeProcessor!
    private var attributes: Attributes!

    override func setUp() {
        super.setUp()
        userDefaultStorage = MockUserDefaultStorage()
        userAttributeProcessor = UserAttributeProcessor(userDefaultStorage: userDefaultStorage)
        attributes = Attributes()
    }

    override func tearDown() {
        userDefaultStorage = nil
        userAttributeProcessor = nil
        attributes = nil
        super.tearDown()
    }

    func testSetsUserIdInMemoryAndUpdatesUserDefaults() {
        userAttributeProcessor.setUserId("user-id")

        XCTAssertEqual("user-id", userAttributeProcessor.getUserId())
        XCTAssertEqual("user-id", userDefaultStorage.getUserId())
    }

    func testClearsUserIdFromMemoryAndUserDefaults() {
        userAttributeProcessor.setUserId("user-id")

        userAttributeProcessor.clearUserId()

        XCTAssertNil(userAttributeProcessor.getUserId())
        XCTAssertNil(userDefaultStorage.getUserId())
    }

    func testAppendsUserIdToAttributesFromMemory() {
        userAttributeProcessor.setUserId("user-id")

        userAttributeProcessor.appendAttributes(&attributes)

        XCTAssertEqual("user-id", attributes.userId)
    }

    func testAppendsUserIdToAttributesFromUserDefaults() {
        userDefaultStorage.setUserId("user-id")

        userAttributeProcessor.appendAttributes(&attributes)

        XCTAssertEqual("user-id", attributes.userId)
    }
}
