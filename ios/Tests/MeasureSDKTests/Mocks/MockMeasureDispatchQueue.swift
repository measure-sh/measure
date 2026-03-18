//
//  MockMeasureDispatchQueue.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/06/25.
//

import Foundation
@testable import Measure

final class MockMeasureDispatchQueue: MeasureDispatchQueue {
    func submitSync(_ block: () -> Void) {
        block()
    }

    func submit(_ block: @escaping () -> Void) {
        block()
    }

    func schedule(after delay: TimeInterval, _ block: @escaping () -> Void) {
        block()
    }
}
