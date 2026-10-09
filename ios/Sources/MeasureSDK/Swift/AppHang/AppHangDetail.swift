//
//  AppHangDetail.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

struct AppHangDetail: Codable {
    /// The name of the thread. Always the main thread for an app hang.
    let threadName: String?

    /// The sequence number of the thread.
    let threadSequence: Number

    /// The OS System Build unique for the device.
    let osBuildNumber: String?

    /// An optional array of `StackFrame` objects representing the stack frames of the blocked thread.
    let frames: [StackFrame]?

    enum CodingKeys: String, CodingKey {
        case threadName = "thread_name"
        case threadSequence = "thread_sequence"
        case osBuildNumber = "os_build_number"
        case frames
    }
}
