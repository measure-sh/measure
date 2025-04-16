//
//  Checkpoint.swift
//  Measure
//
//  Created by Adwin Ross on 08/04/25.
//

import Foundation

/// Represents a checkpoint in a span's lifecycle.
public struct Checkpoint: Codable {
    /// The name of the checkpoint.
    public let name: String

    /// The timestamp when the checkpoint was created.
    public let timestamp: String

    public init(name: String, timestamp: String) {
        self.name = name
        self.timestamp = timestamp
    }
}
