//
//  ShakeBugReportCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/05/25.
//

import XCTest
@testable import Measure

final class ShakeBugReportCollectorTests: XCTestCase {
    func test_onShake_invokesHandler() {
        let bugManager = MockBugReportManager()
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(shakeDetector: shakeDetector)

        var didCall = false
        collector.setShakeHandler {
            didCall = true
        }

        shakeDetector.simulateShake()

        XCTAssertTrue(didCall)
        XCTAssertFalse(bugManager.didOpenBugReporter)
    }

    func test_setShakeHandler_nil_stopsDetector() {
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(shakeDetector: shakeDetector)

        collector.setShakeHandler(nil)

        XCTAssertTrue(shakeDetector.didStop)
        XCTAssertNil(shakeDetector.getShakeListener())
    }

    func test_pause_stopsDetector() {
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(shakeDetector: shakeDetector)
        collector.setShakeHandler {}

        collector.pause()

        XCTAssertTrue(shakeDetector.didStop)
    }

    func test_resume_startsDetector_whenHandlerIsSet() {
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(shakeDetector: shakeDetector)
        collector.setShakeHandler {}
        collector.pause()
        shakeDetector.didStart = false

        collector.resume()

        XCTAssertTrue(shakeDetector.didStart)
    }

    func test_resume_doesNothing_whenNoHandlerIsSet() {
        let shakeDetector = MockShakeDetector()
        let collector = ShakeBugReportCollector(shakeDetector: shakeDetector)

        collector.resume()

        XCTAssertFalse(shakeDetector.didStart)
    }
}
