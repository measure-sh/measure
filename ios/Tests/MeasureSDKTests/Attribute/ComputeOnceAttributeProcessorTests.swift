//
//  ComputeOnceAttributeProcessorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import XCTest
@testable import Measure

final class ComputeOnceAttributeProcessorTests: XCTestCase {
    func testComputeAttributesIsOnlyCalledOnceWhenAppendingAttributes() {
        class TestComputeOnceAttributeProcessor: BaseComputeOnceAttributeProcessor {
            var computeAttributesCalledCount = 0

            override func computeAttributes() {
                computeAttributesCalledCount += 1
            }
            override func updateAttribute(_ attribute: inout Attributes) {}
        }

        let processor = TestComputeOnceAttributeProcessor()
        var attributes = Attributes()

        processor.appendAttributes(&attributes)
        processor.appendAttributes(&attributes)
        processor.appendAttributes(&attributes)

        XCTAssertEqual(processor.computeAttributesCalledCount, 1)
    }
}
