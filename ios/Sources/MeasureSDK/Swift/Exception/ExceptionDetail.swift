//
//  ExceptionDetail.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

public struct ExceptionDetail: Codable {
    /// The type of the exception.
    let type: String?

    /// The error message text associated with the exception.
    let message: String?

    /// An optional array of `StackFrame` objects representing the stack frames at the time of the exception.
    let frames: [StackFrame]?

    /// An optional POSIX signal received by the process.
    let signal: String?

    /// The name of the thread.
    let threadName: String

    /// The sequence number of the thread
    let threadSequence: Number

    /// The OS System Build unique for the device
    let osBuildNumber: String
    
    // Custom initializer to provide default values for missing fields
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        type = try container.decode(String.self, forKey: .type) 
        message = try container.decode(String.self, forKey: .message)
        frames = try container.decodeIfPresent([StackFrame].self, forKey: .frames)
        signal = try container.decodeIfPresent(String.self, forKey: .signal)
        
        // Provide default values for fields not present in Flutter data
        threadName = try container.decodeIfPresent(String.self, forKey: .threadName) ?? "main"
        threadSequence = try container.decodeIfPresent(Number.self, forKey: .threadSequence) ?? 0
        osBuildNumber = try container.decodeIfPresent(String.self, forKey: .osBuildNumber) ?? UIDevice.current.systemVersion
    }
    
    // Standard initializer
    public init(type: String?, message: String?, frames: [StackFrame]?, signal: String?, threadName: String, threadSequence: Number, osBuildNumber: String) {
        self.type = type
        self.message = message
        self.frames = frames
        self.signal = signal
        self.threadName = threadName
        self.threadSequence = threadSequence
        self.osBuildNumber = osBuildNumber
    }

    enum CodingKeys: String, CodingKey {
        case type
        case message
        case frames
        case signal
        case threadName = "thread_name"
        case threadSequence = "thread_sequence"
        case osBuildNumber = "os_build_number"
    }
}
