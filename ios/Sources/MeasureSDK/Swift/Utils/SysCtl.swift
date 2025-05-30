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

    func getCpuFrequency() -> UInt64 { // swiftlint:disable:this function_body_length
        guard clockSpeed == 0 else {
            return clockSpeed
        }

        // Get device model identifier
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let deviceModel = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }

        let cpuFrequencies: [String: UInt64] = [
            // iPhone
            "iPhone5,1": 1300000000, // iPhone 5
            "iPhone5,2": 1300000000, // iPhone 5
            "iPhone5,3": 1000000000, // iPhone 5C
            "iPhone5,4": 1000000000, // iPhone 5C
            "iPhone6,1": 1300000000, // iPhone 5S
            "iPhone6,2": 1300000000, // iPhone 5S
            "iPhone7,1": 1400000000, // iPhone 6 Plus
            "iPhone7,2": 1400000000, // iPhone 6
            "iPhone8,1": 1850000000, // iPhone 6s
            "iPhone8,2": 1850000000, // iPhone 6s Plus
            "iPhone8,4": 1850000000, // iPhone SE (1st Gen)
            "iPhone9,1": 2340000000, // iPhone 7
            "iPhone9,2": 2340000000, // iPhone 7 Plus
            "iPhone9,3": 2340000000, // iPhone 7
            "iPhone9,4": 2340000000, // iPhone 7 Plus
            "iPhone10,1": 2390000000, // iPhone 8
            "iPhone10,2": 2390000000, // iPhone 8 Plus
            "iPhone10,3": 2390000000, // iPhone X
            "iPhone10,4": 2390000000, // iPhone 8
            "iPhone10,5": 2390000000, // iPhone 8 Plus
            "iPhone10,6": 2390000000, // iPhone X
            "iPhone11,2": 2490000000, // iPhone XS
            "iPhone11,4": 2490000000, // iPhone XS Max
            "iPhone11,6": 2490000000, // iPhone XS Max
            "iPhone11,8": 2490000000, // iPhone XR
            "iPhone12,1": 2650000000, // iPhone 11
            "iPhone12,3": 2650000000, // iPhone 11 Pro
            "iPhone12,5": 2650000000, // iPhone 11 Pro Max
            "iPhone12,8": 2650000000, // iPhone SE 2nd Gen
            "iPhone13,1": 2990000000, // iPhone 12 Mini
            "iPhone13,2": 2990000000, // iPhone 12
            "iPhone13,3": 2990000000, // iPhone 12 Pro
            "iPhone13,4": 2990000000, // iPhone 12 Pro Max
            "iPhone14,2": 3230000000, // iPhone 13 Pro
            "iPhone14,3": 3230000000, // iPhone 13 Pro Max
            "iPhone14,4": 3230000000, // iPhone 13 Mini
            "iPhone14,5": 3230000000, // iPhone 13
            "iPhone14,6": 3230000000, // iPhone SE 3rd Gen
            "iPhone14,7": 3460000000, // iPhone 14
            "iPhone14,8": 3460000000, // iPhone 14 Plus
            "iPhone15,2": 3780000000, // iPhone 14 Pro
            "iPhone15,3": 3780000000, // iPhone 14 Pro Max
            "iPhone15,4": 3460000000, // iPhone 15
            "iPhone15,5": 3460000000, // iPhone 15 Plus
            "iPhone16,1": 4000000000, // iPhone 15 Pro
            "iPhone16,2": 4000000000, // iPhone 15 Pro Max
            "iPhone17,1": 4000000000, // iPhone 16 Pro
            "iPhone17,2": 4000000000, // iPhone 16 Pro Max
            "iPhone17,3": 3800000000, // iPhone 16
            "iPhone17,4": 3800000000, // iPhone 16 Plus
            "iPhone17,5": 3800000000, // iPhone 16e

            // iPads
            "iPad6,11": 1850000000, // iPad (2017)
            "iPad6,12": 1850000000, // iPad (2017)
            "iPad7,5": 2100000000,  // iPad 6th Gen
            "iPad7,6": 2100000000,  // iPad 6th Gen
            "iPad7,11": 2200000000, // iPad 7th Gen
            "iPad7,12": 2200000000, // iPad 7th Gen
            "iPad11,6": 2500000000, // iPad 8th Gen
            "iPad11,7": 2500000000, // iPad 8th Gen
            "iPad12,1": 2500000000, // iPad 9th Gen
            "iPad12,2": 2500000000, // iPad 9th Gen
            "iPad13,18": 2500000000, // iPad 10th Gen
            "iPad13,19": 2500000000, // iPad 10th Gen
            "iPad13,1": 3200000000,  // iPad Air 4
            "iPad13,2": 3200000000,  // iPad Air 4
            "iPad13,16": 3490000000, // iPad Air 5
            "iPad13,17": 3490000000, // iPad Air 5
            "iPad14,8": 3490000000,  // iPad Air 6
            "iPad14,9": 3490000000,  // iPad Air 6
            "iPad14,10": 3490000000, // iPad Air 6
            "iPad14,11": 3490000000, // iPad Air 6
            "iPad15,3": 3780000000,  // iPad Air 7
            "iPad15,4": 3780000000,  // iPad Air 7
            "iPad15,5": 3780000000,  // iPad Air 7
            "iPad15,6": 3780000000,  // iPad Air 7
            "iPad15,7": 3460000000,  // iPad 11th Gen
            "iPad15,8": 3460000000,  // iPad 11th Gen
            "iPad16,1": 3200000000,  // iPad mini 7
            "iPad16,2": 3200000000,  // iPad mini 7
            "iPad14,1": 3000000000,  // iPad mini 6
            "iPad14,2": 3000000000,  // iPad mini 6

            // Simulators
            "arm64": 2400000000,     // Apple Silicon Simulator
            "x86_64": 2400000000,    // Intel Mac Simulator
            "i386": 2400000000       // Older 32-bit simulators
        ]

        clockSpeed = cpuFrequencies[deviceModel] ?? 0
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
