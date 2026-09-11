//
//  LayoutSnapshotThrottler.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 10/09/26.
//

import Foundation

protocol LayoutSnapshotThrottler {
    func shouldTakeSnapshot(delayMs: Number) -> Bool
}

/// Controls the frequency of layout snapshots by enforcing a minimum time interval between captures.
/// Shared across every capture site (gestures, lifecycle events, screen views) so all of them count
/// against the same window instead of throttling independently.
final class BaseLayoutSnapshotThrottler: LayoutSnapshotThrottler {
    private let timeProvider: TimeProvider
    private var lastSnapshotAttemptTimestamp: Number = 0

    init(timeProvider: TimeProvider) {
        self.timeProvider = timeProvider
    }

    func shouldTakeSnapshot(delayMs: Number = 750) -> Bool {
        let now = timeProvider.millisTime
        let previous = lastSnapshotAttemptTimestamp
        lastSnapshotAttemptTimestamp = now
        return previous == 0 || (now - previous) > delayMs
    }
}
