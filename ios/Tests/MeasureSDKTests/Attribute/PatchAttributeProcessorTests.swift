//
//  PatchAttributeProcessorTests.swift
//  MeasureSDKTests
//

import XCTest
@testable import Measure

final class PatchAttributeProcessorTests: XCTestCase {
    private var patchAttributeProcessor: PatchAttributeProcessor!
    private var attributes: Attributes!

    override func setUp() {
        super.setUp()
        patchAttributeProcessor = PatchAttributeProcessor()
        attributes = Attributes()
    }

    override func tearDown() {
        patchAttributeProcessor = nil
        attributes = nil
        super.tearDown()
    }

    func testDoesNotAppendPatchAttributesWhenPatchIsNotSet() {
        patchAttributeProcessor.appendAttributes(attributes)

        XCTAssertNil(attributes.patchId)
        XCTAssertNil(attributes.patchVersion)
    }

    func testAppendsPatchIdAndVersionToAttributesOnceSet() {
        patchAttributeProcessor.setPatch("patch-id", patchVersion: "v1.0.3-hotfix")

        patchAttributeProcessor.appendAttributes(attributes)

        XCTAssertEqual("patch-id", attributes.patchId)
        XCTAssertEqual("v1.0.3-hotfix", attributes.patchVersion)
    }

    func testAppendsPatchIdWithoutVersionWhenVersionIsNotSet() {
        patchAttributeProcessor.setPatch("patch-id", patchVersion: nil)

        patchAttributeProcessor.appendAttributes(attributes)

        XCTAssertEqual("patch-id", attributes.patchId)
        XCTAssertNil(attributes.patchVersion)
    }
}
