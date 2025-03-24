//
//  AttributeProcessorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import XCTest
@testable import Measure

final class AttributeProcessorTests: XCTestCase {
    func testAppendsAttributes() {
        var attributes = Attributes(deviceName: "iPhone 14")

        let attributeProcessor1 = MockAttributeProcessor { attributes in
            attributes.threadName = "com.thread.main"
        }
        let attributeProcessor2 = MockAttributeProcessor { attributes in
            attributes.measureSdkVersion = "0.0.1"
        }

        let processors: [AttributeProcessor] = [attributeProcessor1, attributeProcessor2]
        processors.forEach { $0.appendAttributes(&attributes) }

        XCTAssertEqual(attributes.threadName, "com.thread.main")
        XCTAssertEqual(attributes.measureSdkVersion, "0.0.1")
        XCTAssertEqual(attributes.deviceName, "iPhone 14")
    }

    func testUpdatesValueIfTwoProcessorsSetSameKey() {
        var attributes = Attributes(deviceName: "iPhone 14")

        let attributeProcessor1 = MockAttributeProcessor { attributes in
            attributes.threadName = "com.thread.main"
        }
        let attributeProcessor2 = MockAttributeProcessor { attributes in
            attributes.threadName = "com.thread.background"
        }

        let processors: [AttributeProcessor] = [attributeProcessor1, attributeProcessor2]
        processors.forEach { $0.appendAttributes(&attributes) }

        XCTAssertEqual(attributes.threadName, "com.thread.background")
        XCTAssertEqual(attributes.deviceName, "iPhone 14")
    }

    func testNoopWhenEmptyListOfProcessorsIsPassed() {
        var attributes = Attributes()

        let processors: [AttributeProcessor] = []
        processors.forEach { $0.appendAttributes(&attributes) }

        XCTAssertEqual(attributes.threadName, nil)
        XCTAssertEqual(attributes.deviceName, nil)
        XCTAssertEqual(attributes.deviceModel, nil)
        XCTAssertEqual(attributes.deviceManufacturer, nil)
        XCTAssertEqual(attributes.deviceType, nil)
        XCTAssertEqual(attributes.deviceIsFoldable, nil)
        XCTAssertEqual(attributes.deviceIsPhysical, nil)
        XCTAssertEqual(attributes.deviceDensityDpi, nil)
        XCTAssertEqual(attributes.deviceWidthPx, nil)
        XCTAssertEqual(attributes.deviceHeightPx, nil)
        XCTAssertEqual(attributes.deviceDensity, nil)
        XCTAssertEqual(attributes.deviceLocale, nil)
        XCTAssertEqual(attributes.osName, nil)
        XCTAssertEqual(attributes.osVersion, nil)
        XCTAssertEqual(attributes.platform, "")
        XCTAssertEqual(attributes.networkType, nil)
        XCTAssertEqual(attributes.networkGeneration, nil)
        XCTAssertEqual(attributes.networkProvider, nil)
        XCTAssertEqual(attributes.installationId, "")
        XCTAssertEqual(attributes.userId, nil)
        XCTAssertEqual(attributes.deviceCpuArch, nil)
        XCTAssertEqual(attributes.appVersion, "")
        XCTAssertEqual(attributes.appBuild, "")
        XCTAssertEqual(attributes.measureSdkVersion, "")
        XCTAssertEqual(attributes.appUniqueId, "")
    }
}
