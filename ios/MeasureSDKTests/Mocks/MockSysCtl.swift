//
//  MockSysCtl.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/24.
//

import Foundation
@testable import MeasureSDK

final class MockSysCtl: SysCtl {
    var mockCpuCores: UInt8 = 0
    var mockCpuFrequency: UInt32 = 0
    var mockMaximumAvailableRam: UnsignedNumber = 0

    func getCpuCores() -> UInt8 {
        return mockCpuCores
    }

    func getCpuFrequency() -> UInt32 {
        return mockCpuFrequency
    }

    func getMaximumAvailableRam() -> UnsignedNumber {
        return mockMaximumAvailableRam
    }
}
