//
//  AppHangState.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

/// The end state of an app hang.
enum AppHangState: String, Codable {
    /// The main thread resumed and the app became responsive again.
    case recovered

    /// The process died while the main thread was still blocked. Detected on the next app launch.
    case killed
}
