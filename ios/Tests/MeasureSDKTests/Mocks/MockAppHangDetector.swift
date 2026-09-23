//
//  MockAppHangDetector.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation
@testable import Measure

final class MockAppHangDetector: AppHangDetector {
    weak var callbacks: AppHangCallbacks?
    private(set) var enableCallCount = 0
    private(set) var disableCallCount = 0

    var isEnabled: Bool {
        enableCallCount > disableCallCount
    }

    func enable() {
        enableCallCount += 1
    }

    func disable() {
        disableCallCount += 1
    }
}

final class MockAppHangCollector: AppHangCollector {
    private(set) var enableCallCount = 0
    private(set) var disableCallCount = 0
    private(set) var onConfigLoadedCallCount = 0

    func onConfigLoaded() {
        onConfigLoadedCallCount += 1
    }

    var isEnabled: Bool {
        enableCallCount > disableCallCount
    }

    func enable() {
        enableCallCount += 1
    }

    func disable() {
        disableCallCount += 1
    }
}
