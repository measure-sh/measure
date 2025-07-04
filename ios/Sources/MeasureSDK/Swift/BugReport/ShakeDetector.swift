//
//  ShakeDetector.swift
//  Measure
//
//  Created by Adwin Ross on 09/05/25.
//

import Foundation

/// Interface defining shake detection capability
protocol ShakeDetector {
    /// Start listening for shake events
    /// - Returns: `true` if successfully started, `false` otherwise
    @discardableResult
    func start() -> Bool

    /// Stop listening for shake events
    func stop()

    /// Set a listener to be notified of shake events
    func setShakeListener(_ listener: ShakeDetectorListener?)

    /// For testing: Get the current shake listener
    func getShakeListener() -> ShakeDetectorListener?
}

/// Listener protocol to receive shake events
protocol ShakeDetectorListener: AnyObject {
    func onShake()
}
