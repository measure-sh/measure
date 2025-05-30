//
//  MockAttributeProcessor.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import Foundation
@testable import Measure

typealias AttributeAppendBlock = (inout Attributes) -> Void

final class MockAttributeProcessor: AttributeProcessor {
    private let appendBlock: AttributeAppendBlock
    var appendCalled = false

    init(appendBlock: @escaping AttributeAppendBlock) {
        self.appendBlock = appendBlock
    }

    func appendAttributes(_ attributes: inout Attributes) {
        appendCalled = true
        appendBlock(&attributes)
    }
}
