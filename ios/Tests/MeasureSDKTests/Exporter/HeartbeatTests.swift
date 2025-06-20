//
//  HeartbeatTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

@testable import Measure
import XCTest

final class MockHeartbeatListener: HeartbeatListener {
    var pulseCalledCount = 0
    private let lock = NSLock()
    private let pulseExpectation: XCTestExpectation?

    init(pulseExpectation: XCTestExpectation? = nil) {
        self.pulseExpectation = pulseExpectation
    }

    func pulse() {
        lock.lock()
        pulseCalledCount += 1
        pulseExpectation?.fulfill()
        lock.unlock()
    }
}

final class BaseHeartbeatTests: XCTestCase {
    var heartbeat: BaseHeartbeat!

    override func tearDown() {
        heartbeat?.stop()
        heartbeat = nil
        super.tearDown()
    }

    func testListenerReceivesPulseAfterStart() {
        let expectation = expectation(description: "Listener should receive pulse")
        let listener = MockHeartbeatListener(pulseExpectation: expectation)

        heartbeat = BaseHeartbeat()
        heartbeat.addListener(listener)
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(listener.pulseCalledCount, 1)
    }

    func testStopPreventsFurtherPulses() {
        let pulseExpectation = expectation(description: "Pulse count before stop should be 2")
        pulseExpectation.expectedFulfillmentCount = 2

        let listener = MockHeartbeatListener(pulseExpectation: pulseExpectation)

        heartbeat = BaseHeartbeat()
        heartbeat.addListener(listener)
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)

        wait(for: [pulseExpectation], timeout: 1.0)

        heartbeat.stop()
        let pulseCountAtStop = listener.pulseCalledCount

        let waitExpectation = expectation(description: "Confirm no more pulses after stop")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            XCTAssertEqual(listener.pulseCalledCount, pulseCountAtStop)
            waitExpectation.fulfill()
        }

        wait(for: [waitExpectation], timeout: 0.5)
    }

    func testStartDoesNotTriggerMultipleTimers() {
        let expectation = expectation(description: "Listener should receive only one pulse")
        expectation.expectedFulfillmentCount = 1

        let listener = MockHeartbeatListener(pulseExpectation: expectation)

        heartbeat = BaseHeartbeat()
        heartbeat.addListener(listener)
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)
        heartbeat.start(intervalMs: 100, initialDelayMs: 0) // Second start shouldn't add a new timer

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(listener.pulseCalledCount, 1)
    }
}
