//
//  Exception.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

struct Exception: Codable {
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

    enum CodingKeys: String, CodingKey {
        case handled
        case exceptions
        case foreground
        case threads
        case binaryImages = "binary_images"
    }
}
