//
//  ExceptionDetails.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/08/24.
//

struct ExceptionDetail: Codable {
    
    /// The type of the exception.
    let type: String
    
    /// The error message text associated with the exception.
    let message: String
    
    /// An optional array of `StackFrame` objects representing the stack frames at the time of the exception.
    let frames: [StackFrame]?
    
    /// An optional POSIX signal received by the process.
    let signal: String?
    
    /// The name of the thread.
    let threadName: String
    
    /// The sequence number of the thread
    let threadSequence: Int
    
    /// CPU Architecture, can be one of `arm64e`, `x86_64`, `arm64`, `armv7k`, `armv6`, `armv7`, `armv7f`, `armv7s`, `arm`, `i386`, `arm64`
    let cpuArch: String
    
    /// The OS System Build unique for the device
    let operatingSystemBuild: String
    
    enum CodingKeys: String, CodingKey {
        case type
        case message
        case frames
        case signal
        case threadName = "thread-name"
        case threadSequence = "thread-sequence"
        case cpuArch = "cpu-arch"
        case operatingSystemBuild = "operating-system-build"
    }
    
    init(type: String, 
         message: String,
         frames: [StackFrame]?,
         signal: String?,
         threadName: String,
         threadSequence: Int,
         cpuArch: String,
         operatingSystemBuild: String) {
        self.type = type
        self.message = message
        self.frames = frames
        self.signal = signal
        self.threadName = threadName
        self.threadSequence = threadSequence
        self.cpuArch = cpuArch
        self.operatingSystemBuild = operatingSystemBuild
    }
    
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        type = try values.decode(String.self, forKey: .type)
        message = try values.decode(String.self, forKey: .message)
        frames = try values.decodeIfPresent([StackFrame].self, forKey: .frames)
        signal = try values.decodeIfPresent(String.self, forKey: .signal)
        threadName = try values.decode(String.self, forKey: .threadName)
        threadSequence = try values.decode(Int.self, forKey: .threadSequence)
        cpuArch = try values.decode(String.self, forKey: .cpuArch)
        operatingSystemBuild = try values.decode(String.self, forKey: .operatingSystemBuild)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        try container.encode(message, forKey: .message)
        try container.encodeIfPresent(frames, forKey: .frames)
        try container.encodeIfPresent(signal, forKey: .signal)
        try container.encode(threadName, forKey: .threadName)
        try container.encode(threadSequence, forKey: .threadSequence)
        try container.encode(cpuArch, forKey: .cpuArch)
        try container.encode(operatingSystemBuild, forKey: .operatingSystemBuild)
    }
}
