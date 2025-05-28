//
//  ShakeBugReportCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/05/25.
//

import XCTest
@testable import Measure

final class ShakeBugReportCollectorTests: XCTestCase {
    func test_autoLaunchEnabled_initializesCorrectly() {
        let bugManager = MockBugReportManager()
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(
            autoLaunchEnabled: true,
            bugReportManager: bugManager,
            shakeDetector: shakeDetector,
            screenshotGenerator: MockScreenshotGenerator()
        )

        XCTAssertTrue(collector.isShakeToLaunchBugReportEnabled())
        XCTAssertTrue(shakeDetector.didStart)
        XCTAssertNotNil(shakeDetector.getShakeListener())
    }

    func test_enableAutoLaunch_setsStateAndStartsDetector() {
        let bugManager = MockBugReportManager()
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(
            autoLaunchEnabled: false,
            bugReportManager: bugManager,
            shakeDetector: shakeDetector,
            screenshotGenerator: MockScreenshotGenerator()
        )

        collector.enableAutoLaunch(takeScreenshot: true)

        XCTAssertTrue(collector.isShakeToLaunchBugReportEnabled())
        XCTAssertTrue(shakeDetector.didStart)
        XCTAssertNotNil(shakeDetector.getShakeListener())
    }

    func test_disableAutoLaunch_stopsDetector() {
        let bugManager = MockBugReportManager()
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(
            autoLaunchEnabled: true,
            bugReportManager: bugManager,
            shakeDetector: shakeDetector,
            screenshotGenerator: MockScreenshotGenerator()
        )

        collector.disableAutoLaunch()

        XCTAssertFalse(collector.isShakeToLaunchBugReportEnabled())
        XCTAssertTrue(shakeDetector.didStop)
        XCTAssertNil(shakeDetector.getShakeListener())
    }

    func test_onShake_triggersBugReport_whenAutoLaunchEnabled() {
        let bugManager = MockBugReportManager()
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(
            autoLaunchEnabled: false,
            bugReportManager: bugManager,
            shakeDetector: shakeDetector,
            screenshotGenerator: MockScreenshotGenerator()
        )

        collector.enableAutoLaunch(takeScreenshot: true)
        shakeDetector.simulateShake()

        XCTAssertTrue(bugManager.didOpenBugReporter)
        XCTAssertEqual(bugManager.receivedTakeScreenshot, true)
    }

    func test_onShake_delegatesToListener_whenAutoLaunchDisabled() {
        let bugManager = MockBugReportManager()
        let shakeDetector = MockShakeDetector()
        let listener = MockMsrShakeListener()
        let collector = ShakeBugReportCollector(
            autoLaunchEnabled: false,
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
            autoLaunchEnabled: false,
            bugReportManager: bugManager,
            shakeDetector: shakeDetector,
            screenshotGenerator: MockScreenshotGenerator()
        )

        collector.setShakeListener(nil)

        XCTAssertTrue(shakeDetector.didStop)
        XCTAssertNil(shakeDetector.getShakeListener())
    }
}
