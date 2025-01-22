//
//  MockCpuUsageCalculator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/24.
//

import Foundation
@testable import MeasureSDK

final class MockCpuUsageCalculator: CpuUsageCalculator {
    var mockCpuUsage: FloatNumber64 = 0.0

    func getCurrentCpuUsage() -> FloatNumber64 {
        return mockCpuUsage
    }
}
