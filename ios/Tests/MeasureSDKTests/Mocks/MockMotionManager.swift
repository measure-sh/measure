//
//  MockMotionManager.swift
//  Measure
//
//  Created by Adwin Ross on 22/05/25.
//

import CoreMotion
import XCTest
@testable import Measure

final class MockMotionManager: MotionManager {
    var isAccelerometerAvailable: Bool = true
    var accelerometerUpdateInterval: TimeInterval = 0.0
    var startCalled = false
    var stopCalled = false
    private var capturedHandler: CMAccelerometerHandler?

    func startAccelerometerUpdates(to queue: OperationQueue, withHandler handler: @escaping CMAccelerometerHandler) {
        startCalled = true
        capturedHandler = handler
    }

    func stopAccelerometerUpdates() {
        stopCalled = true
    }

    func simulateAcceleration(x: Double, y: Double, z: Double) { // swiftlint:disable:this identifier_name
        guard let handler = capturedHandler else { return }
        let data = TestableAccelerometerData(x: x, y: y, z: z)
        handler(data, nil)
    }
}

final class MockShakeListener: ShakeDetectorListener {
    var didShakeCount = 0
    func onShake() {
        didShakeCount += 1
    }

    var didShake: Bool {
        return didShakeCount > 0
    }
}

final class TestableAccelerometerData: CMAccelerometerData {
    private let testAcceleration: CMAcceleration

    init(x: Double, y: Double, z: Double) { // swiftlint:disable:this identifier_name
        self.testAcceleration = CMAcceleration(x: x, y: y, z: z)
        super.init()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var acceleration: CMAcceleration {
        return testAcceleration
    }
}
