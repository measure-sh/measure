//
//  Checkpoint.swift
//  Measure
//
//  Created by Adwin Ross on 08/04/25.
//

import Foundation

/// Represents a checkpoint in a span's lifecycle.
public struct Checkpoint {
    /// The name of the checkpoint.
    public let name: String

    /// The timestamp when the checkpoint was created.
    public let timestamp: Int64

    public init(name: String, timestamp: Int64) {
        self.name = name
        self.timestamp = timestamp
    }
}
