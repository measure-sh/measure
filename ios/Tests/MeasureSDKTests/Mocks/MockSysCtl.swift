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
    var mockCpuFrequency: UInt64 = 0
    var mockMaximumAvailableRam: UnsignedNumber = 0
    var processStartTime: UnsignedNumber = 0
    var systemBootTime: UnsignedNumber = 0

    func getCpuCores() -> UInt8 {
        return mockCpuCores
    }

    func getCpuFrequency() -> UInt64 {
        return mockCpuFrequency
    }

    func getMaximumAvailableRam() -> UnsignedNumber {
        return mockMaximumAvailableRam
    }

    func getProcessStartTime() -> UnsignedNumber? {
        return processStartTime
    }

    func getSystemBootTime() -> UnsignedNumber? {
        return systemBootTime
    }
}
