//
//  AppHang.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

/// An app hang: the main thread blocked for longer than the configured threshold.
///
/// This is the iOS counterpart of Android's ANR, but iOS exposes no OS-level ANR concept, so the
/// SDK detects it itself. It is a top-level event type rather than a variant of `Exception`,
/// because `severity` cannot express the recovered-vs-killed outcome without making a fatal hang
/// indistinguishable from a genuine crash in any query filtering on `severity = 'fatal'`.
///
/// `duration` and `state` are mutable because a hang is written the moment it is detected and
/// rewritten when it resolves. See `AppHangState`.
struct AppHang: Codable {
    /// The blocked thread. Only the main thread is captured, so this holds exactly one element.
    let exceptions: [AppHangDetail]

    /// How long the main thread was blocked, in milliseconds.
    ///
    /// Exact when `state` is `recovered`. Best-effort when `killed`, since the app did not survive
    /// to observe the hang ending.
    var duration: Number

    /// Whether the main thread resumed, or the process died while still blocked.
    var state: AppHangState

    /// Specifies the framework where the app hang originated from.
    let framework: String

    /// Whether the app was in the foreground when the hang was detected.
    let foreground: Bool

    /// All the `BinaryImage`s needed to symbolicate `exceptions`.
    ///
    /// Captured at detection time and persisted with the event: the addresses in `frames` are only
    /// meaningful against the image load addresses of the process that hung, and ASLR gives a
    /// different slide on the next launch.
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
