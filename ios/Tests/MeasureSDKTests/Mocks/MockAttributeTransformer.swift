//
//  MockAttributeTransformer.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 05/05/26.
//

import Foundation
@testable import Measure

final class MockAttributeTransformer: AttributeTransformer {
    private(set) var transformCallCount = 0
    private(set) var lastInput: [String: Any]?
    var returnValue: [String: AttributeValue] = [:]

    func transformAttributes(_ attributes: [String: Any]?) -> [String: AttributeValue] {
        transformCallCount += 1
        lastInput = attributes
        return returnValue
    }
}
