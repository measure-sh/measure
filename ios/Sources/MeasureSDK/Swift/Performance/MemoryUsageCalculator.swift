//
//  MemoryUsageCalculator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 09/11/24.
//

import Foundation
import os

struct MemoryUsageSnapshot {
    let usedMemory: UnsignedNumber
    let availableMemory: UnsignedNumber?
}

protocol MemoryUsageCalculator {
    func getCurrentMemoryUsage() -> MemoryUsageSnapshot?
}

final class BaseMemoryUsageCalculator: MemoryUsageCalculator {
    typealias MemoryInfo = (info: task_vm_info_data_t, count: mach_msg_type_number_t)
    private let memoryInfo: () -> MemoryInfo?
    private let availableMemory: () -> UnsignedNumber?

    init(memoryInfo: @escaping () -> MemoryInfo? = BaseMemoryUsageCalculator.readMemoryInfo,
         availableMemory: @escaping () -> UnsignedNumber? = BaseMemoryUsageCalculator.readAvailableMemory) {
        self.memoryInfo = memoryInfo
        self.availableMemory = availableMemory
    }

    func getCurrentMemoryUsage() -> MemoryUsageSnapshot? {
        guard let (info, count) = memoryInfo() else { return nil }
        if count >= mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<Int32>.size) {
            return MemoryUsageSnapshot(usedMemory: info.phys_footprint / 1024,
                                       availableMemory: availableMemory().map { $0 / 1024 })
        }
        // Remaining process headroom is defined relative to footprint, not RSS.
        return MemoryUsageSnapshot(usedMemory: info.resident_size / 1024, availableMemory: nil)
    }

    private static func readAvailableMemory() -> UnsignedNumber? {
        #if os(iOS) && !targetEnvironment(simulator) && !targetEnvironment(macCatalyst)
        // Advisory headroom changes during execution. Sample it with every footprint reading.
        return UnsignedNumber(os_proc_available_memory())
        #else
        return nil
        #endif
    }

    private static func readMemoryInfo() -> MemoryInfo? {
        var info = task_vm_info_data_t()
        var size = mach_msg_type_number_t(MemoryLayout.size(ofValue: info) / MemoryLayout<Int32>.size)

        let kerr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: Int32.self, capacity: Int(size)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &size)
            }
        }

        return kerr == KERN_SUCCESS ? (info, size) : nil
    }
}
