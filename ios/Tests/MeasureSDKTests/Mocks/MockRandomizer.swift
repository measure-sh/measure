//
//  MockRandomizer.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import Measure

final class MockRandomizer: Randomizer {
    var randomFloat: Float = 0.0
    var randomInt: Int64 = 0

    func random() -> Float {
        return randomFloat
    }
    
    func nextLong() -> Int64 {
        return randomInt
    }
}
