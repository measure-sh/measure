//
//  MotionShakeDetector.swift
//  Measure
//
//  Created by Adwin Ross on 13/05/25.
//

import UIKit

/// A shake detector that relies on UIKit's built-in motion detection
final class MotionShakeDetector: ShakeDetector {
    private weak var listener: ShakeDetectorListener?

    /// This shake detector doesn't start/stop hardware updates; it relies on UIResponder forwarding.
    @discardableResult
    func start() -> Bool {
        // No-op for motionEnded approach
        return true
    }

    func stop() {
        // No-op for motionEnded approach
    }

    func setShakeListener(_ listener: ShakeDetectorListener?) {
        self.listener = listener
    }

    func getShakeListener() -> ShakeDetectorListener? {
        return listener
    }

    func handleMotionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        guard motion == .motionShake else { return }
        listener?.onShake()
    }
}
