//
//  SysCtl.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 11/11/24.
//

import Foundation

protocol SysCtl {
    func getCpuCores() -> UInt8
    func getCpuFrequency() -> UInt32
    func getMaximumAvailableRam() -> UnsignedNumber
}

final class BaseSysCtl: SysCtl {
    private var maximumAvailableRam: UnsignedNumber = 0
    private var cpuCores: UInt8 = 0
    private var clockSpeed: UInt32 = 0

    func getCpuCores() -> UInt8 {
        guard cpuCores == 0 else {
            return cpuCores
        }
        var numCores = 0
        var size = MemoryLayout<Int>.size
        sysctlbyname("hw.ncpu", &numCores, &size, nil, 0)
        cpuCores = UInt8(numCores)
        return cpuCores
    }

    func getCpuFrequency() -> UInt32 {
        guard clockSpeed == 0 else {
            return clockSpeed
        }
        var cpuFrequencyHz: Int64 = 0
        var size = MemoryLayout<Int64>.size
        sysctlbyname("hw.cpufrequency", &cpuFrequencyHz, &size, nil, 0)
        clockSpeed = UInt32(cpuFrequencyHz)
        return clockSpeed
    }

    func getMaximumAvailableRam() -> UnsignedNumber {
        guard maximumAvailableRam == 0 else {
            return maximumAvailableRam
        }
        var memorySize: UInt64 = 0
        var size = MemoryLayout<UInt64>.size
        if sysctlbyname("hw.memsize", &memorySize, &size, nil, 0) == 0 {
            self.maximumAvailableRam = memorySize / 1024
            return self.maximumAvailableRam
        }
        return 0
    }
}
