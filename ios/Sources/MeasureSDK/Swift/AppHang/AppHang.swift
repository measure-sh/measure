//
//  AppHang.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

struct AppHang: Codable {
    /// An array of `AppHangDetail` objects representing the app hang.
    let exceptions: [AppHangDetail]

    /// How long the main thread was blocked, in milliseconds.
    var duration: Number

    /// Whether the main thread resumed, or the process died while still blocked.
    var state: AppHangState

    /// Specifies the framework where the app hang originated from.
    let framework: String

    /// Whether the app was in the foreground when the hang was detected.
    let foreground: Bool

    /// All the `BinaryImage`s needed to symbolicate `exceptions`.
    let binaryImages: [BinaryImage]?

    enum CodingKeys: String, CodingKey {
        case exceptions
        case duration
        case state
        case framework
        case foreground
        case binaryImages = "binary_images"
    }
}
