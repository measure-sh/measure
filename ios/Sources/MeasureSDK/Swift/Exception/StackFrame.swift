//
//  StackFrame.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

struct StackFrame: Codable {
    /// The name of the binary where the frame resides.
    let binaryName: String?

    /// The memory address of the binary where the frame resides.
    let binaryAddress: String?

    /// The offset from the binary's base address.
    let offset: Int?

    /// The index of the frame in the stack trace.
    let frameIndex: Number?

    /// The memory address of the symbol in the binary.
    let symbolAddress: String?

    /// `true` if the frame originates from the app module
    let inApp: Bool
    
    /// The  class name where the frame originated from.
    let className: String?
    
    /// The  method name where the frame originated from.
    let methodName: String?
    
    /// The  file name where the frame originated from.
    let fileName: String?
    
    /// The  line number where the frame originated from.
    let lineNumber: Number?
    
    /// The  column number where the frame originated from.
    let columnNumber: Number?
    
    /// The library or module where the crash occurred.
    let moduleName: String?
    
    /// The instruction address of the frame.
    let instructionAddress: String?

    enum CodingKeys: String, CodingKey {
        case binaryName = "binary_name"
        case binaryAddress = "binary_address"
        case offset
        case frameIndex = "frame_index"
        case symbolAddress = "symbol_address"
        case inApp = "in_app"
        case className = "class_name"
        case methodName = "method_name"
        case fileName = "file_name"
        case lineNumber = "line_num"
        case columnNumber = "col_num"
        case moduleName = "module_name"
        case instructionAddress = "instruction_address"
    }
}
