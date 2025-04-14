//
//  Randomizer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 01/09/24.
//

import Foundation

/// Protocol for generating random numbers.
protocol Randomizer {
    /// Returns a random float between 0.0 and 1.0.
    func random() -> Float

    /// Returns a random 64-bit integer.
    func nextLong() -> Int64
}

/// A simple randomizer that uses the system's random number generator.
final class BaseRandomizer: Randomizer {
    func random() -> Float {
        return Float.random(in: 0...1)
    }

    func nextLong() -> Int64 {
        return Int64.random(in: Int64.min...Int64.max)
    }
}
