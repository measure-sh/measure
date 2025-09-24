//
//  MockAttributeProcessor.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import Foundation
@testable import Measure

typealias AttributeAppendBlock = (Attributes) -> Void

final class MockAttributeProcessor: AttributeProcessor {
    private let appendBlock: AttributeAppendBlock
    var appendCalled = false

    init(appendBlock: @escaping AttributeAppendBlock) {
        self.appendBlock = appendBlock
    }

    func appendAttributes(_ attributes: Attributes) {
        appendCalled = true
        appendBlock(attributes)
    }
}
