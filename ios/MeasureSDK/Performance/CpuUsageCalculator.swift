//
//  CpuUsageCalculator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 09/11/24.
//

import Foundation
import MachO

protocol CpuUsageCalculator {
    func getCurrentCpuUsage() -> FloatNumber64
}

final class BaseCpuUsageCalculator: CpuUsageCalculator {
    func getCurrentCpuUsage() -> FloatNumber64 {
        var kern: kern_return_t
        var taskInfoCount: mach_msg_type_number_t = mach_msg_type_number_t(TASK_INFO_MAX)
        var tinfo = [integer_t](repeating: 0, count: Int(taskInfoCount))

        kern = task_info(mach_task_self_, task_flavor_t(TASK_BASIC_INFO), &tinfo, &taskInfoCount)
        if kern != KERN_SUCCESS {
            return -1
        }

        var threadList: thread_act_array_t?
        var threadCount: mach_msg_type_number_t = 0
        defer {
            if let threadList = threadList {
                vm_deallocate(mach_task_self_, vm_address_t(UnsafePointer(threadList).pointee), vm_size_t(threadCount))
            }
        }

        kern = task_threads(mach_task_self_, &threadList, &threadCount)
        if kern != KERN_SUCCESS {
            return -1
        }

        var totalCpu: Double = 0

        if let threadList = threadList {
            for index in 0 ..< Int(threadCount) {
                var threadInfoCount = mach_msg_type_number_t(THREAD_INFO_MAX)
                var threadInfo = [integer_t](repeating: 0, count: Int(threadInfoCount))

                kern = thread_info(threadList[index], thread_flavor_t(THREAD_BASIC_INFO), &threadInfo, &threadInfoCount)
                if kern != KERN_SUCCESS {
                    return -1
                }

                var threadBasicInfo = thread_basic_info()
                threadBasicInfo.user_time = time_value_t(seconds: threadInfo[0], microseconds: threadInfo[1])
                threadBasicInfo.system_time = time_value_t(seconds: threadInfo[2], microseconds: threadInfo[3])
                threadBasicInfo.cpu_usage = threadInfo[4]
                threadBasicInfo.policy = threadInfo[5]
                threadBasicInfo.run_state = threadInfo[6]
                threadBasicInfo.flags = threadInfo[7]
                threadBasicInfo.suspend_count = threadInfo[8]
                threadBasicInfo.sleep_time = threadInfo[9]

                if threadBasicInfo.flags != TH_FLAGS_IDLE {
                    totalCpu += (Double(threadBasicInfo.cpu_usage) / Double(TH_USAGE_SCALE)) * 100.0
                }
            }
        }

        return totalCpu
    }
}
