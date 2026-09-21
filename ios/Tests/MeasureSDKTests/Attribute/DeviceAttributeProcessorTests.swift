//
//  DeviceAttributeProcessorTests.swift
//  MeasureSDKTests
//

import XCTest
@testable import Measure

final class DeviceAttributeProcessorTests: XCTestCase {
    func testAppendsTotalMemoryInKiB() {
        let sysCtl = MockSysCtl()
        sysCtl.mockMaximumAvailableRam = 6 * 1024 * 1024
        let processor = DeviceAttributeProcessor(sysCtl: sysCtl)
        let attributes = Attributes()
        processor.appendAttributes(attributes)

        XCTAssertEqual(attributes.deviceTotalMemory, 6 * 1024 * 1024)
    }

    func testAppendsZeroWhenTotalMemoryIsUnknown() {
        let processor = DeviceAttributeProcessor(sysCtl: MockSysCtl())
        let attributes = Attributes()
        processor.appendAttributes(attributes)

        XCTAssertEqual(attributes.deviceTotalMemory, 0)
    }
}
