//
//  MemoryUsageCalculatorTests.swift
//  MeasureSDKTests
//

import XCTest
@testable import Measure

final class MemoryUsageCalculatorTests: XCTestCase {
    func testFootprintAndHeadroomAreConvertedToKiB() throws {
        var info = task_vm_info_data_t()
        info.phys_footprint = 2048
        info.resident_size = 8192
        let calculator = BaseMemoryUsageCalculator(
            memoryInfo: { (info, self.fullMemoryInfoCount) },
            availableMemory: { 4096 }
        )

        let snapshot = try XCTUnwrap(calculator.getCurrentMemoryUsage())

        XCTAssertEqual(snapshot.usedMemory, 2)
        XCTAssertEqual(snapshot.availableMemory, 4)
    }

    func testHeadroomIsResampledAndZeroIsTreatedAsUnknown() throws {
        var info = task_vm_info_data_t()
        info.phys_footprint = 2048
        var availableMemory: UnsignedNumber = 4096
        let calculator = BaseMemoryUsageCalculator(
            memoryInfo: { (info, self.fullMemoryInfoCount) },
            availableMemory: { availableMemory }
        )
        let firstSnapshot = try XCTUnwrap(calculator.getCurrentMemoryUsage())
        XCTAssertEqual(firstSnapshot.availableMemory, 4)

        availableMemory = 0
        let secondSnapshot = try XCTUnwrap(calculator.getCurrentMemoryUsage())

        XCTAssertNil(secondSnapshot.availableMemory, "A zero from os_proc_available_memory() reports no limit, not an exhausted budget")
    }

    func testResidentFallbackDoesNotReadHeadroom() throws {
        var info = task_vm_info_data_t()
        info.resident_size = 4096
        let calculator = BaseMemoryUsageCalculator(
            memoryInfo: { (info, 0) },
            availableMemory: {
                XCTFail("Headroom cannot be paired with resident size")
                return 1024
            }
        )

        let snapshot = try XCTUnwrap(calculator.getCurrentMemoryUsage())

        XCTAssertEqual(snapshot.usedMemory, 4)
        XCTAssertNil(snapshot.availableMemory)
    }

    func testFailedMemoryReadSkipsHeadroom() {
        let calculator = BaseMemoryUsageCalculator(
            memoryInfo: { nil },
            availableMemory: {
                XCTFail("Headroom must not be read after task_info fails")
                return 0
            }
        )

        XCTAssertNil(calculator.getCurrentMemoryUsage())
    }

    #if targetEnvironment(simulator)
    func testSimulatorOmitsHeadroom() throws {
        let calculator = BaseMemoryUsageCalculator()

        let snapshot = try XCTUnwrap(calculator.getCurrentMemoryUsage())

        XCTAssertNil(snapshot.availableMemory)
    }
    #endif

    private var fullMemoryInfoCount: mach_msg_type_number_t {
        mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<Int32>.size)
    }
}
