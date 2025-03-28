//
//  HeartbeatTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

@testable import Measure
import XCTest

final class MockHeartbeatListener: HeartbeatListener {
    var pulseCalled = false
    var pulseCalledCount = 0
    private let lock = NSLock()

    func pulse() {
        lock.lock()
        pulseCalled = true
        pulseCalledCount += 1
        lock.unlock()
    }
}

final class BaseHeartbeatTests: XCTestCase {
    var heartbeat: BaseHeartbeat!
    var mockListener: MockHeartbeatListener!

    override func setUp() {
        super.setUp()
        heartbeat = BaseHeartbeat()
        mockListener = MockHeartbeatListener()
        heartbeat.addListener(mockListener)
    }

    override func tearDown() {
        heartbeat.stop()
        heartbeat = nil
        mockListener = nil
        super.tearDown()
    }

    func testListenerReceivesPulseAfterStart() {
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)

        let expectation = XCTestExpectation(description: "Listener should receive pulse")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            XCTAssertTrue(self.mockListener.pulseCalled, "Listener should have received pulse")
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)
    }

    func testStopPreventsFurtherPulses() {
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            self.heartbeat.stop()
        }

        let expectation = XCTestExpectation(description: "Listener should not receive pulse after stop")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            XCTAssertTrue(self.mockListener.pulseCalledCount == 2, "Listener should not receive pulse after stop")
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)
    }

    func testStartDoesNotTriggerMultipleTimers() {
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)

        let expectation = XCTestExpectation(description: "Listener should receive only one pulse")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            XCTAssertTrue(self.mockListener.pulseCalled, "Listener should have received pulse")
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)
    }
}
