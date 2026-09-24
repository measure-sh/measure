//
//  MockAppHangCallbacks.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation
@testable import Measure

final class MockAppHangCallbacks: AppHangCallbacks {
    private let lock = NSLock()

    private var started = 0
    private var ended = 0
    private var discarded = 0
    private var duration: Number?
    private var capturedStack: AppHangStack?

    var startedCount: Int { withLock { started } }
    var endedCount: Int { withLock { ended } }
    var discardedCount: Int { withLock { discarded } }
    var lastDurationMs: Number? { withLock { duration } }
    var lastStack: AppHangStack? { withLock { capturedStack } }

    private func withLock<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }

    func onAppHangStarted(stack: AppHangStack?, thresholdMs: Number, timestamp: Number) {
        withLock {
            started += 1
            capturedStack = stack
        }
    }

    private var heartbeats: [Number] = []
    var heartbeatCount: Int { withLock { heartbeats.count } }
    var lastHeartbeatMs: Number? { withLock { heartbeats.last } }

    func onAppHangHeartbeat(elapsedMs: Number) {
        withLock { heartbeats.append(elapsedMs) }
    }

    func onAppHangEnded(durationMs: Number) {
        withLock {
            ended += 1
            duration = durationMs
        }
    }

    func onAppHangDiscarded(reason: String) {
        withLock { discarded += 1 }
    }
}
