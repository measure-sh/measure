//
//  AppHangState.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

/// The outcome of an app hang.
///
/// An app hang is reported as `killed` the moment it is detected, because the process may die
/// before the main thread ever responds again. It is rewritten to `recovered` only once the main
/// thread actually resumes.
enum AppHangState: String, Codable {
    /// The main thread resumed and the app became responsive again.
    case recovered

    /// The process died while the main thread was still blocked. Detected on the next app launch.
    case killed
}
