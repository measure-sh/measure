//
//  Exception.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

struct Exception: Codable {
    /// An array of `ExceptionDetail` objects representing the exceptions.
    let exceptions: [ExceptionDetail]

    /// A boolean indicating whether the app was in the foreground at the time of the exception.
    var foreground: Bool?

    /// An optional array of `Thread` objects representing the threads at the time of the exception.
    let threads: [ThreadDetail]?

    /// An optional array of all the `BinaryImage` needed for symbolication.
    let binaryImages: [BinaryImage]?

    /// Specifies the framework where the exception originated from.
    let framework: String?

    /// Severity level of the exception.
    let severity: ExceptionSeverity?

    /// `true` for user-tracked errors. Defaults to `false`.
    let isCustom: Bool?

    /// Numeric code that describes the exception.
    let numCode: Int64?

    /// String code that describes the exception.
    let code: String?

    /// Object containing arbitrary fields for the exception's metadata.
    let meta: [String: CodableValue]?

    enum CodingKeys: String, CodingKey {
        case exceptions
        case foreground
        case threads
        case binaryImages = "binary_images"
        case framework
        case severity
        case isCustom = "is_custom"
        case numCode = "num_code"
        case code
        case meta
    }
}
