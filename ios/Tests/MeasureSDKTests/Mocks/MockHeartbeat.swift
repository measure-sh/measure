//
//  MockHeartbeat.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import Foundation
@testable import Measure

class MockHeartbeat: Heartbeat {
    var isStarted = false
    var isStopped = false
    var addedListeners: [HeartbeatListener] = []
    var startIntervalMs: Number?
    var startInitialDelayMs: Number?

    func addListener(_ listener: HeartbeatListener) {
        addedListeners.append(listener)
    }

    func start(intervalMs: Number, initialDelayMs: Number) {
        isStarted = true
        startIntervalMs = intervalMs
        startInitialDelayMs = initialDelayMs
    }

    func stop() {
        isStopped = true
    }

    func triggerPulse() {
        addedListeners.forEach { $0.pulse() }
    }
}
