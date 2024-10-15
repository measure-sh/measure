//
//  Randomizer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 01/09/24.
//

import Foundation

/// Protocol for generating random numbers.
protocol Randomizer {
    func random() -> Float
}

/// Implementation of the Randomizer protocol.
struct BaseRandomizer: Randomizer {
    /// Returns a random number between 0.0 and 1.0.
    func random() -> Float {
        return Float.random(in: 0.0...1.0)
    }
}
