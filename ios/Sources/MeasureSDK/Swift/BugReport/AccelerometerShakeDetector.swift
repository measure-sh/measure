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
    private let configProvider: ConfigProvider

    init(configProvider: ConfigProvider) {
        self.configProvider = configProvider
    }

    func start() -> Bool {
        guard motionManager.isAccelerometerAvailable else {
            return false
        }

        motionManager.accelerometerUpdateInterval = configProvider.accelerometerUpdateInterval
        motionManager.startAccelerometerUpdates(to: queue) { [weak self] data, _ in
            guard let self, let acceleration = data?.acceleration else { return }

            let gForce = sqrt(
                acceleration.x * acceleration.x +
                acceleration.y * acceleration.y +
                acceleration.z * acceleration.z
            )

            if gForce > Double(self.configProvider.shakeAccelerationThreshold) &&
                Date().timeIntervalSince(self.lastShakeTime) > Double(self.configProvider.shakeMinTimeIntervalMs/1000) {
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
