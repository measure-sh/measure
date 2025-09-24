//
//  AccelerometerShakeDetectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/05/25.
//

import XCTest
@testable import Measure

final class AccelerometerShakeDetectorTests: XCTestCase {
    func test_start_whenAccelerometerUnavailable_returnsFalse() {
        let mockMotion = MockMotionManager()
        mockMotion.isAccelerometerAvailable = false
        let config = MockConfigProvider()
        let detector = AccelerometerShakeDetector(configProvider: config, motionManager: mockMotion)

        let result = detector.start()

        XCTAssertFalse(result)
        XCTAssertFalse(mockMotion.startCalled)
    }

    func test_start_whenAccelerometerAvailable_startsAndSetsInterval() {
        let mockMotion = MockMotionManager()
        mockMotion.isAccelerometerAvailable = true
        let config = MockConfigProvider()
        config.accelerometerUpdateInterval = 0.02
        let detector = AccelerometerShakeDetector(configProvider: config, motionManager: mockMotion)

        let result = detector.start()

        XCTAssertTrue(result)
        XCTAssertTrue(mockMotion.startCalled)
        XCTAssertEqual(mockMotion.accelerometerUpdateInterval, 0.02)
    }

    func test_stop_stopsAccelerometer() {
        let mockMotion = MockMotionManager()
        let detector = AccelerometerShakeDetector(configProvider: MockConfigProvider(), motionManager: mockMotion)

        detector.stop()

        XCTAssertTrue(mockMotion.stopCalled)
    }

    func test_setAndGetShakeListener() {
        let detector = AccelerometerShakeDetector(configProvider: MockConfigProvider(), motionManager: MockMotionManager())
        let listener = MockShakeListener()

        detector.setShakeListener(listener)

        XCTAssertTrue(detector.getShakeListener() === listener)
    }

    func test_onShake_triggered_whenGForceExceedsThreshold() {
        let motion = MockMotionManager()
        let config = MockConfigProvider()
        config.shakeAccelerationThreshold = 1.0
        config.shakeMinTimeIntervalMs = 0

        let detector = AccelerometerShakeDetector(configProvider: config, motionManager: motion)
        let listener = MockShakeListener()
        let expectation = self.expectation(description: "Shake should be triggered")
        listener.onShakeCallback = {
            expectation.fulfill()
        }

        detector.setShakeListener(listener)
        detector.start()
        motion.simulateAcceleration(x: 2.0, y: 2.0, z: 2.0)

        wait(for: [expectation], timeout: 1.0)
    }

    func test_onShake_notTriggered_belowThreshold() {
        let motion = MockMotionManager()
        let config = MockConfigProvider()
        config.shakeAccelerationThreshold = 10.0

        let detector = AccelerometerShakeDetector(configProvider: config, motionManager: motion)
        let listener = MockShakeListener()
        detector.setShakeListener(listener)
        detector.start()
        motion.simulateAcceleration(x: 1.0, y: 1.0, z: 1.0)

        let expectation = self.expectation(description: "No shake should be triggered")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            XCTAssertFalse(listener.didShake)
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)
    }

    func test_onShake_respectsMinimumInterval() {
        let motion = MockMotionManager()
        let config = MockConfigProvider()
        config.shakeAccelerationThreshold = 1.0
        config.shakeMinTimeIntervalMs = 1000

        let detector = AccelerometerShakeDetector(configProvider: config, motionManager: motion)
        let listener = MockShakeListener()

        let expectation = self.expectation(description: "Only one shake should be triggered")
        listener.onShakeCallback = {
            if listener.didShakeCount == 1 {
                // Simulate another shake that should be ignored
                motion.simulateAcceleration(x: 2.0, y: 2.0, z: 2.0)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    XCTAssertEqual(listener.didShakeCount, 1)
                    expectation.fulfill()
                }
            }
        }

        detector.setShakeListener(listener)
        detector.start()
        motion.simulateAcceleration(x: 2.0, y: 2.0, z: 2.0)

        wait(for: [expectation], timeout: 1.0)
    }
}
