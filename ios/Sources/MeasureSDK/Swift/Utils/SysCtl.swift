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
    func getProcessStartTime() -> UnsignedNumber?
    func getSystemBootTime() -> UnsignedNumber?
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

    func getProcessStartTime() -> UnsignedNumber? {
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        var procInfo = kinfo_proc()
        var size = MemoryLayout.size(ofValue: procInfo)

        let result = sysctl(&mib, UInt32(mib.count), &procInfo, &size, nil, 0)
        guard result == 0 else {
            return nil
        }

        let startTime = procInfo.kp_proc.p_un.__p_starttime
        return UnsignedNumber(startTime.tv_sec) + UnsignedNumber(startTime.tv_usec) / 1_000_000
    }

    func getSystemBootTime() -> UnsignedNumber? {
        var cmd = [CTL_KERN, KERN_BOOTTIME]
        var bootTimeVal = timeval(tv_sec: 0, tv_usec: 0)
        var size = MemoryLayout.size(ofValue: bootTimeVal)

        let result = sysctl(&cmd, UInt32(cmd.count), &bootTimeVal, &size, nil, 0)
        if result != 0 {
            return nil
        }

        return UnsignedNumber(bootTimeVal.tv_sec) + UnsignedNumber(bootTimeVal.tv_usec) / 1_000_000
    }

}
