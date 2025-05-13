//
//  AccelerometerShakeDetector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 09/05/25.
//

import CoreMotion
import Foundation

final class AccelerometerShakeDetector: ShakeDetector {
    private let motionManager = CMMotionManager()
    private let queue = OperationQueue()
    private weak var listener: ShakeDetectorListener?
    private var lastShakeTime: Date = .distantPast

    private let shakeThreshold: Double = 2.7
    private let minimumShakeInterval: TimeInterval = 1.0

    func start() -> Bool {
        guard motionManager.isAccelerometerAvailable else {
            return false
        }

        motionManager.accelerometerUpdateInterval = 0.1
        motionManager.startAccelerometerUpdates(to: queue) { [weak self] data, _ in
            guard let self, let acceleration = data?.acceleration else { return }

            let gForce = sqrt(
                acceleration.x * acceleration.x +
                acceleration.y * acceleration.y +
                acceleration.z * acceleration.z
            )

            if gForce > self.shakeThreshold &&
               Date().timeIntervalSince(self.lastShakeTime) > self.minimumShakeInterval {
                self.lastShakeTime = Date()
                DispatchQueue.main.async {
                    self.listener?.onShake()
                }
            }
        }

        return true
    }

    func stop() {
        motionManager.stopAccelerometerUpdates()
    }

    func setShakeListener(_ listener: (any ShakeDetectorListener)?) {
        self.listener = listener
    }

    func getShakeListener() -> (any ShakeDetectorListener)? {
        return listener
    }
}
