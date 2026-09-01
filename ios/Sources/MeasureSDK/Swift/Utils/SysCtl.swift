//
//  SysCtl.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 11/11/24.
//

import Foundation

protocol SysCtl {
    func getCpuCores() -> UInt8
    func getClockTicksPerSecond() -> UInt64
    func getMaximumAvailableRam() -> UnsignedNumber
    func getProcessStartTime() -> UnsignedNumber?
    func getSystemBootTime() -> UnsignedNumber?
    func getOsBuildNumber() -> String?
}

final class BaseSysCtl: SysCtl {
    private var maximumAvailableRam: UnsignedNumber = 0
    private var cpuCores: UInt8 = 0
    private var clockTicksPerSecond: UInt64 = 0
    private var osBuildNumber: String?

    func getCpuCores() -> UInt8 {
        guard cpuCores == 0 else {
            return cpuCores
        }
        var numCores = 0
        var size = MemoryLayout<Int>.size
        sysctlbyname("hw.ncpu", &numCores, &size, nil, 0)
        cpuCores = UInt8(clamping: numCores)
        return cpuCores
    }

    func getClockTicksPerSecond() -> UInt64 {
        guard clockTicksPerSecond == 0 else {
            return clockTicksPerSecond
        }

        let ticks = sysconf(Int32(_SC_CLK_TCK))
        clockTicksPerSecond = ticks > 0 ? UInt64(ticks) : 0
        return clockTicksPerSecond
    }

    func getMaximumAvailableRam() -> UnsignedNumber {
        guard maximumAvailableRam == 0 else {
            return maximumAvailableRam
        }
        var memorySize: UInt64 = 0
        var size = MemoryLayout<UInt64>.size
        if sysctlbyname("hw.memsize", &memorySize, &size, nil, 0) == 0 {
            self.maximumAvailableRam = memorySize / 1024
        }
        return self.maximumAvailableRam
    }

    func getProcessStartTime() -> UnsignedNumber? {
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]

        var kproc = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride

        let result = sysctl(&mib, u_int(mib.count), &kproc, &size, nil, 0)
        guard result == 0 else { return nil }

        let procStartTime = kproc.kp_proc.p_un.__p_starttime
        let procStartTimeMillis = UInt64(procStartTime.tv_sec) * 1000 + UInt64(procStartTime.tv_usec) / 1000
        return procStartTimeMillis
    }

    func getSystemBootTime() -> UnsignedNumber? {
        var bootTime = timeval()
        var size = MemoryLayout<timeval>.stride
        var mib: [Int32] = [CTL_KERN, KERN_BOOTTIME]
        guard sysctl(&mib, 2, &bootTime, &size, nil, 0) == 0 else { return nil }

        return UnsignedNumber(bootTime.tv_sec) * 1000 + UnsignedNumber(bootTime.tv_usec) / 1000
    }

    func getOsBuildNumber() -> String? {
        if let osBuildNumber {
            return osBuildNumber
        }
        var size = 0
        sysctlbyname("kern.osversion", nil, &size, nil, 0)
        guard size > 0 else { return nil }
        var build = [CChar](repeating: 0, count: size)
        guard sysctlbyname("kern.osversion", &build, &size, nil, 0) == 0 else { return nil }
        osBuildNumber = String(cString: build)
        return osBuildNumber
    }

}
