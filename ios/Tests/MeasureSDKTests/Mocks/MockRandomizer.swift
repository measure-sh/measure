//
//  MockRandomizer.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import Measure

final class MockRandomizer: Randomizer {
    var randomNumder: Float
    func random() -> Float {
        return randomNumder
    }

    init(_ randomNumder: Float) {
        self.randomNumder = randomNumder
    }
}
