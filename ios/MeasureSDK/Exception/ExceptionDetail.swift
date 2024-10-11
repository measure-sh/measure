//
//  ExceptionDetail.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

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
    let threadSequence: Number

    /// The OS System Build unique for the device
    let osBuildNumber: String

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
