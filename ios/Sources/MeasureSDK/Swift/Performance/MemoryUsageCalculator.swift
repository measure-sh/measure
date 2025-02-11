//
//  MemoryUsageCalculator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 09/11/24.
//

import Foundation

protocol MemoryUsageCalculator {
    func getCurrentMemoryUsage() -> UnsignedNumber?
}

final class BaseMemoryUsageCalculator: MemoryUsageCalculator {
    func getCurrentMemoryUsage() -> UnsignedNumber? {
        var info = task_vm_info_data_t()
        var size = mach_msg_type_number_t(MemoryLayout.size(ofValue: info) / MemoryLayout<Int32>.size)

        let kerr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: Int32.self, capacity: Int(size)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &size)
            }
        }

        if kerr == KERN_SUCCESS {
            if size >= mach_msg_type_number_t(MemoryLayout.size(ofValue: info) / MemoryLayout<Int32>.size) {
                return UnsignedNumber(info.phys_footprint / 1024)
            } else {
                return UnsignedNumber(info.resident_size / 1024)
            }
        }
        return nil
    }
}
