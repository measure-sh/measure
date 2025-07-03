//
//  ShakeBugReportCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/05/25.
//

import XCTest
@testable import Measure

final class ShakeBugReportCollectorTests: XCTestCase {
    func test_onShake_delegatesToListener() {
        let bugManager = MockBugReportManager()
        let shakeDetector = MockShakeDetector()
        let listener = MockMsrShakeListener()
        let collector = ShakeBugReportCollector(
            bugReportManager: bugManager,
            shakeDetector: shakeDetector,
            screenshotGenerator: MockScreenshotGenerator()
        )

        collector.setShakeListener(listener)
        shakeDetector.simulateShake()

        XCTAssertTrue(listener.didShakeCalled)
        XCTAssertFalse(bugManager.didOpenBugReporter)
    }

    func test_setShakeListener_nilListener_stopsDetector() {
        let bugManager = MockBugReportManager()
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(
            bugReportManager: bugManager,
            shakeDetector: shakeDetector,
            screenshotGenerator: MockScreenshotGenerator()
        )

        collector.setShakeListener(nil)

        XCTAssertTrue(shakeDetector.didStop)
        XCTAssertNil(shakeDetector.getShakeListener())
    }
}
