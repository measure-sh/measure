//
//  SysCtl.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 11/11/24.
//

import Foundation

protocol SysCtl {
    func getCpuCores() -> UInt8
    func getCpuFrequency() -> UInt64
    func getMaximumAvailableRam() -> UnsignedNumber
    func getProcessStartTime() -> UnsignedNumber?
    func getSystemBootTime() -> UnsignedNumber?
}

final class BaseSysCtl: SysCtl {
    private var maximumAvailableRam: UnsignedNumber = 0
    private var cpuCores: UInt8 = 0
    private var clockSpeed: UInt64 = 0

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

    func getCpuFrequency() -> UInt64 {
        guard clockSpeed == 0 else {
            return clockSpeed
        }
        let cpuFrequencies: [String: UInt64] = [
            // --- A-Series Chips (iPhones & iPads) ---
            "A17 Pro": 3780000000,   // 3.78 GHz
            "A16 Bionic": 3460000000,   // 3.46 GHz
            "A15 Bionic": 3230000000,   // 3.23 GHz
            "A14 Bionic": 3100000000,   // 3.10 GHz
            "A13 Bionic": 2650000000,   // 2.65 GHz
            "A12Z Bionic": 2490000000,  // 2.49 GHz (iPad Pro)
            "A12X Bionic": 2490000000,  // 2.49 GHz (iPad Pro)
            "A12 Bionic": 2490000000,   // 2.49 GHz
            "A11 Bionic": 2390000000,   // 2.39 GHz
            "A10X Fusion": 2380000000,  // 2.38 GHz (iPad Pro)
            "A10 Fusion": 2340000000,   // 2.34 GHz
            "A9X": 2260000000,  // 2.26 GHz (iPad Pro)
            "A9": 1850000000,   // 1.85 GHz

            // --- Apple Silicon (Mac & iPad Pro) ---
            "M4 Max": 4500000000,  // 4.50 GHz
            "M4 Pro": 4500000000,  // 4.50 GHz
            "M4": 4400000000,  // 4.40 GHz
            "M3 Max": 4250000000,  // 4.25 GHz
            "M3 Pro": 4100000000,  // 4.10 GHz
            "M3": 4000000000,  // 4.00 GHz
            "M2 Ultra": 3490000000,  // 3.49 GHz
            "M2 Max": 3490000000,  // 3.49 GHz
            "M2 Pro": 3490000000,  // 3.49 GHz
            "M2": 3490000000,  // 3.49 GHz
            "M1 Ultra": 3200000000,  // 3.20 GHz
            "M1 Max": 3200000000,  // 3.20 GHz
            "M1 Pro": 3200000000,  // 3.20 GHz
            "M1": 3200000000   // 3.20 GHz
        ]

        var size = 0
        sysctlbyname("machdep.cpu.brand_string", nil, &size, nil, 0)
        var cpuName = [CChar](repeating: 0, count: size)
        sysctlbyname("machdep.cpu.brand_string", &cpuName, &size, nil, 0)

        var modelName = String(cString: cpuName)
        modelName = modelName.replacingOccurrences(of: "Apple ", with: "")
        clockSpeed = cpuFrequencies[modelName] ?? 0

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
