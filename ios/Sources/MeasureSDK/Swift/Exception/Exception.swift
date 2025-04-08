//
//  Exception.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

public struct Exception: Codable {
    /// A boolean indicating whether the exception was handled.
    let handled: Bool

    /// An array of `ExceptionDetail` objects representing the exceptions.
    let exceptions: [ExceptionDetail]

    /// A boolean indicating whether the app was in the foreground at the time of the exception.
    var foreground: Bool?

    /// An optional array of `Thread` objects representing the threads at the time of the exception.
    let threads: [ThreadDetail]?

    /// An optional array of all the `BinaryImage` needed for symbolication.
    let binaryImages: [BinaryImage]?
    
    // Custom initializer to handle Flutter exception data format
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        handled = try container.decode(Bool.self, forKey: .handled)
        exceptions = try container.decode([ExceptionDetail].self, forKey: .exceptions)
        
        // Optional fields that might be missing in Flutter data
        foreground = try container.decodeIfPresent(Bool.self, forKey: .foreground) ?? true
        threads = try container.decodeIfPresent([ThreadDetail].self, forKey: .threads)
        binaryImages = try container.decodeIfPresent([BinaryImage].self, forKey: .binaryImages)
    }
    
    // Standard initializer
    public init(handled: Bool, exceptions: [ExceptionDetail], foreground: Bool? = nil, threads: [ThreadDetail]? = nil, binaryImages: [BinaryImage]? = nil) {
        self.handled = handled
        self.exceptions = exceptions
        self.foreground = foreground
        self.threads = threads
        self.binaryImages = binaryImages
    }

    enum CodingKeys: String, CodingKey {
        case handled
        case exceptions
        case foreground
        case threads
        case binaryImages = "binary_images"
    }
}
