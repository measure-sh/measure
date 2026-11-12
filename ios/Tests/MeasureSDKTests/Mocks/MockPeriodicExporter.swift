//
//  MockPeriodicExporter.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 10/11/26.
//

import Foundation
@testable import Measure

final class MockPeriodicExporter: PeriodicExporter {
    private(set) var startCallCount = 0
    private(set) var stopCallCount = 0
    private(set) var inForegroundValues: [Bool] = []

    func start() {
        startCallCount += 1
    }

    func stop() {
        stopCallCount += 1
    }

    func setInForeground(_ isInForeground: Bool) {
        inForegroundValues.append(isInForeground)
    }
}
