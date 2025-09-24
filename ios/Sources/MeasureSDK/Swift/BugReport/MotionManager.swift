//
//  MotionManager.swift
//  Measure
//
//  Created by Adwin Ross on 22/05/25.
//

import Foundation
import CoreMotion

protocol MotionManager {
    var isAccelerometerAvailable: Bool { get }
    var accelerometerUpdateInterval: TimeInterval { get set }
    func startAccelerometerUpdates(to queue: OperationQueue, withHandler handler: @escaping CMAccelerometerHandler)
    func stopAccelerometerUpdates()
}

class BaseMotionManager: MotionManager {
    private let motionManager = CMMotionManager()

    var isAccelerometerAvailable: Bool {
        return motionManager.isAccelerometerAvailable
    }

    var accelerometerUpdateInterval: TimeInterval {
        get { motionManager.accelerometerUpdateInterval }
        set { motionManager.accelerometerUpdateInterval = newValue }
    }

    func startAccelerometerUpdates(to queue: OperationQueue, withHandler handler: @escaping CMAccelerometerHandler) {
        motionManager.startAccelerometerUpdates(to: queue, withHandler: handler)
    }

    func stopAccelerometerUpdates() {
        motionManager.stopAccelerometerUpdates()
    }
}
