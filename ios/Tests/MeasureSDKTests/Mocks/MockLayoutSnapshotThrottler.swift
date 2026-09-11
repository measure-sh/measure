//
//  MockLayoutSnapshotThrottler.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 10/09/26.
//

@testable import Measure

final class MockLayoutSnapshotThrottler: LayoutSnapshotThrottler {
    var shouldTakeSnapshotReturnValue = true

    func shouldTakeSnapshot(delayMs: Number) -> Bool {
        return shouldTakeSnapshotReturnValue
    }
}
