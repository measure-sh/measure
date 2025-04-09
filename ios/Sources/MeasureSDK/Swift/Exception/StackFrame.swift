//
//  StackFrame.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

public struct StackFrame: Codable {
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
    let inApp: Bool?
    
    let className: String?
    
    let methodName: String?
    
    let fileName: String?
    
    let lineNumber: Number?
    
    let columnNumber: Number?
    
    let moduleName: String?
    
    let instructionAddress: String?
    
    // Custom initializer to provide default values for fields
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Decode with defaults for fields that might be missing in Flutter data
        binaryName = try container.decodeIfPresent(String.self, forKey: .binaryName)
        binaryAddress = try container.decodeIfPresent(String.self, forKey: .binaryAddress)
        offset = try container.decodeIfPresent(Int.self, forKey: .offset)
        frameIndex = try container.decodeIfPresent(Number.self, forKey: .frameIndex)
        symbolAddress = try container.decodeIfPresent(String.self, forKey: .symbolAddress)
        inApp = try container.decodeIfPresent(Bool.self, forKey: .inApp)
        className = try container.decodeIfPresent(String.self, forKey: .className)
        methodName = try container.decodeIfPresent(String.self, forKey: .methodName)
        fileName = try container.decodeIfPresent(String.self, forKey: .fileName)
        lineNumber = try container.decodeIfPresent(Number.self, forKey: .lineNumber)
        columnNumber = try container.decodeIfPresent(Number.self, forKey: .columnNumber)
        moduleName = try container.decodeIfPresent(String.self, forKey: .moduleName)
        instructionAddress = try container.decodeIfPresent(String.self, forKey: .instructionAddress)
    }
    
    // Standard initializer for creating frames programmatically
    public init(binaryName: String?, binaryAddress: String?, offset: Int?, frameIndex: Number?, symbolAddress: String?, inApp: Bool?, className: String?, methodName: String?, fileName: String?, lineNumber: Number?, columnNumber: Number?, moduleName: String?, instructionAddress: String?) {
        self.binaryName = binaryName
        self.binaryAddress = binaryAddress
        self.offset = offset
        self.frameIndex = frameIndex
        self.symbolAddress = symbolAddress
        self.inApp = inApp
        self.className = className
        self.methodName = methodName
        self.fileName = fileName
        self.lineNumber = lineNumber
        self.columnNumber = columnNumber
        self.moduleName = moduleName
        self.instructionAddress = instructionAddress
    }

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
        case lineNumber = "line_number"
        case columnNumber = "column_number"
        case moduleName = "module_name"
        case instructionAddress = "instruction_address"
    }
}
