//
//  Thread.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

struct ThreadDetail: Codable {
    /// The name of the thread.
    let name: String

    /// An array of `StackFrame` objects representing the stack frames in the thread.
    let frames: [StackFrame]

    /// The sequence number of the thread
    let sequence: Number
}
