//
//  StackFrame.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/08/24.
//

import Foundation

/// Represents information about a single frame in a stack trace.
struct StackFrame: Codable {
    
    /// The name of the binary where the frame resides.
    let binaryName: String
    
    /// The memory address of the binary where the frame resides.
    let binaryAddress: String
    
    /// The offset from the binary's base address.
    let offset: String
    
    /// The index of the frame in the stack trace.
    let frameIndex: Int
    
    /// The memory address of the symbol in the binary.
    let symbolAddress: String
    
    enum CodingKeys: String, CodingKey {
        case binaryName = "binary_name"
        case binaryAddress = "binary_address"
        case offset
        case frameIndex = "frame_index"
        case symbolAddress = "symbol_address"
    }
    
    init(binaryName: String, 
         binaryAddress: String,
         offset: String,
         frameIndex: Int,
         symbolAddress: String) {
        self.binaryName = binaryName
        self.binaryAddress = binaryAddress
        self.offset = offset
        self.frameIndex = frameIndex
        self.symbolAddress = symbolAddress
    }
    
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        binaryName = try values.decode(String.self, forKey: .binaryName)
        binaryAddress = try values.decode(String.self, forKey: .binaryAddress)
        offset = try values.decode(String.self, forKey: .offset)
        frameIndex = try values.decode(Int.self, forKey: .frameIndex)
        symbolAddress = try values.decode(String.self, forKey: .symbolAddress)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(binaryName, forKey: .binaryName)
        try container.encode(binaryAddress, forKey: .binaryAddress)
        try container.encode(offset, forKey: .offset)
        try container.encode(frameIndex, forKey: .frameIndex)
        try container.encode(symbolAddress, forKey: .symbolAddress)
    }
}

