//
//  InstallationIdAttributeProcessorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import XCTest
@testable import Measure

final class InstallationIdAttributeProcessorTests: XCTestCase {
    private var installationId: String!
    private var idProvider: MockIdProvider!
    private var userDefaultStorage: MockUserDefaultStorage!
    private var installationIdAttributeProcessor: InstallationIdAttributeProcessor!
    private var attributes: Attributes!

    override func setUp() {
        super.setUp()
        installationId = "installation_id"
        idProvider = MockIdProvider(installationId)
        userDefaultStorage = MockUserDefaultStorage()
        installationIdAttributeProcessor = InstallationIdAttributeProcessor(userDefaultStorage: userDefaultStorage,
                                                                            idProvider: idProvider)
        attributes = Attributes()
    }

    override func tearDown() {
        installationId = nil
        idProvider = nil
        userDefaultStorage = nil
        installationIdAttributeProcessor = nil
        attributes = nil
        super.tearDown()
    }

    func testGivenInstallationIdIsNotSetThenCreatesStoresAndReturnsInstallationIdInUserDefaults() {
        installationIdAttributeProcessor.appendAttributes(&attributes)

        XCTAssertEqual(attributes.installationId, installationId)
    }

    func testGivenInstallationIdIsAlreadySetThenReturnsTheStoredInstallationId() {
        userDefaultStorage.installationId = installationId

        installationIdAttributeProcessor.appendAttributes(&attributes)

        XCTAssertEqual(attributes.installationId, installationId)
    }
}
