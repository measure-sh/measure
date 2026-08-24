//
//  AllocationMetric.swift
//  PerfTests
//
//  Created by Adwin Ross on 22/08/26.
//

import Darwin
import Foundation
import XCTest
import os

private typealias MallocLoggerFunction = @convention(c) (UInt32, UInt, UInt, UInt, UInt, UInt32) -> Void

private let mallocLogTypeAllocate: UInt32 = 2
private let mallocLogTypeDeallocate: UInt32 = 4

private var countersLock = os_unfair_lock_s()
private var countingEnabled = false
private var allocationCount: Int64 = 0
private var allocatedBytes: Int64 = 0

private let mallocLoggerHook: MallocLoggerFunction = { type, _, arg2, arg3, _, _ in
    guard type & mallocLogTypeAllocate != 0 else { return }

    // realloc reports as allocate|deallocate, and carries the new size in arg3 rather than arg2.
    let size = (type & mallocLogTypeDeallocate != 0) ? arg3 : arg2

    os_unfair_lock_lock(&countersLock)
    if countingEnabled {
        allocationCount += 1
        allocatedBytes += Int64(bitPattern: UInt64(size))
    }
    os_unfair_lock_unlock(&countersLock)
}

final class MallocCounter {
    static let shared = MallocCounter()

    struct Result {
        var count: Int64
        var bytes: Int64
    }

    private let slot: UnsafeMutablePointer<MallocLoggerFunction?>?
    private var previousLogger: MallocLoggerFunction?
    private var isInstalled = false
    private(set) var lastResult = Result(count: 0, bytes: 0)

    private init() {
        if let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "malloc_logger") {
            slot = symbol.assumingMemoryBound(to: MallocLoggerFunction?.self)
        } else {
            slot = nil
        }
    }

    var isAvailable: Bool { slot != nil }

    func start() {
        guard let slot else { return }

        os_unfair_lock_lock(&countersLock)
        allocationCount = 0
        allocatedBytes = 0
        countingEnabled = true
        os_unfair_lock_unlock(&countersLock)

        guard !isInstalled else { return }

        previousLogger = slot.pointee
        slot.pointee = mallocLoggerHook
        isInstalled = true
    }

    func stop() {
        guard let slot else { return }

        if isInstalled {
            slot.pointee = previousLogger
            previousLogger = nil
            isInstalled = false
        }

        os_unfair_lock_lock(&countersLock)
        countingEnabled = false
        lastResult = Result(count: allocationCount, bytes: allocatedBytes)
        os_unfair_lock_unlock(&countersLock)
    }
}

final class AllocationMetric: NSObject, XCTMetric {

    override init() {
        super.init()
    }

    func copy(with zone: NSZone? = nil) -> Any {
        AllocationMetric()
    }

    func willBeginMeasuring() {
        MallocCounter.shared.start()
    }

    func didStopMeasuring() {
        MallocCounter.shared.stop()
    }

    func reportMeasurements(from startTime: XCTPerformanceMeasurementTimestamp,
                            to endTime: XCTPerformanceMeasurementTimestamp) throws -> [XCTPerformanceMeasurement] {
        let result = MallocCounter.shared.lastResult

        return [
            XCTPerformanceMeasurement(identifier: "sh.measure.metric.allocation_count",
                                      displayName: "Allocations",
                                      doubleValue: Double(result.count),
                                      unitSymbol: "allocs",
                                      polarity: .prefersSmaller),
            XCTPerformanceMeasurement(identifier: "sh.measure.metric.allocated_bytes",
                                      displayName: "Allocated",
                                      doubleValue: Double(result.bytes) / 1024.0,
                                      unitSymbol: "kB",
                                      polarity: .prefersSmaller)
        ]
    }
}
