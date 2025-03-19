//
//  StackFrame.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

struct StackFrame: Codable {
    /// The name of the binary where the frame resides.
    let binaryName: String

    /// The memory address of the binary where the frame resides.
    let binaryAddress: String

    /// The offset from the binary's base address.
    let offset: Int

    /// The index of the frame in the stack trace.
    let frameIndex: Number

    /// The memory address of the symbol in the binary.
    let symbolAddress: String

    /// `true` if the frame originates from the app module
    let inApp: Bool

    enum CodingKeys: String, CodingKey {
        case binaryName = "binary_name"
        case binaryAddress = "binary_address"
        case offset
        case frameIndex = "frame_index"
        case symbolAddress = "symbol_address"
        case inApp = "in_app"
    }
}
