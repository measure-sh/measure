//
//  BinaryImage.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 11/02/25.
//

import Foundation

struct BinaryImage: Codable {
    /// Start address - where the binary is loaded into virtual memory
    let startAddress: String?

    /// End address - upper memory boundary of the binary
    let endAddress: String?
    
    /// Base address - The base address for Dart exceptions.
    let baseAddress: String?

    /// Binary marker - indicates a system binary
    let system: Bool?

    /// Name of the app, framework, or library binary
    let name: String?

    /// CPU architecture the binary is compiled for
    let arch: String

    /// Unique fingerprint for the binary's build
    let uuid: String

    /// Full path to where the binary was located at runtime
    let path: String?

    enum CodingKeys: String, CodingKey {
        case startAddress = "start_addr"
        case endAddress = "end_addr"
        case baseAddress = "base_addr"
        case system
        case name
        case arch
        case uuid
        case path
    }
}
