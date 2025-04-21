//
//  Checkpoint.swift
//  Measure
//
//  Created by Adwin Ross on 08/04/25.
//

import Foundation

/// Represents a checkpoint in a span's lifecycle.
struct Checkpoint: Codable {
    /// The name of the checkpoint.
    let name: String

    /// The timestamp when the checkpoint was created.
    let timestamp: String

    init(name: String, timestamp: String) {
        self.name = name
        self.timestamp = timestamp
    }
}
