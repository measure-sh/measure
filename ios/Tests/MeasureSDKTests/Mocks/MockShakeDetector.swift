//
//  MockShakeDetector.swift
//  Measure
//
//  Created by Adwin Ross on 22/05/25.
//

import Foundation
@testable import Measure

final class MockShakeDetector: ShakeDetector {
    private var currentListener: ShakeDetectorListener?

    var didStart = false
    var didStop = false
    var didSetListener: ShakeDetectorListener?

    func start() -> Bool {
        didStart = true
        return true
    }

    func stop() {
        didStop = true
    }

    func setShakeListener(_ listener: ShakeDetectorListener?) {
        didSetListener = listener
        currentListener = listener
    }

    func getShakeListener() -> ShakeDetectorListener? {
        return currentListener
    }

    // Helper for test to simulate shake
    func simulateShake() {
        currentListener?.onShake()
    }
}

final class MockMsrShakeListener: MsrShakeListener {
    var didShakeCalled = false

    func onShake() {
        didShakeCalled = true
    }
}
