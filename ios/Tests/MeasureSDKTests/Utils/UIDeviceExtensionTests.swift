//
//  UIDeviceExtensionTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 08/10/26.
//

import XCTest
@testable import Measure

final class UIDeviceExtensionTests: XCTestCase {
    func testMapToDevice_allMappedNamesFitWithinDeviceModelLimit() {
        let families = ["iPhone", "iPad", "iPod", "AppleTV", "AudioAccessory"]

        for family in families {
            for major in 1...30 {
                for minor in 1...20 {
                    let identifier = "\(family)\(major),\(minor)"
                    let name = UIDevice.mapToDevice(identifier: identifier)

                    XCTAssertLessThanOrEqual(name.count,
                                             ValidationLimits.deviceModel,
                                             "\(identifier) maps to \"\(name)\" which exceeds the device_model limit")
                }
            }
        }
    }

    func testMapToDevice_mapsIPhone16Family() {
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone17,3"), "iPhone 16")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone17,4"), "iPhone 16 Plus")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone17,1"), "iPhone 16 Pro")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone17,2"), "iPhone 16 Pro Max")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone17,5"), "iPhone 16e")
    }

    func testMapToDevice_mapsIPhone17Family() {
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone18,3"), "iPhone 17")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone18,1"), "iPhone 17 Pro")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone18,2"), "iPhone 17 Pro Max")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone18,4"), "iPhone Air")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone18,5"), "iPhone 17e")
    }

    func testMapToDevice_mapsIPhone18Family() {
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone19,2"), "iPhone 18 Pro")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone19,3"), "iPhone 18 Pro Max")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone19,7"), "iPhone 18 Pro Max")
    }

    func testMapToDevice_mapsNewIPadModels() {
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad15,7"), "iPad (A16)")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad15,3"), "iPad Air (11-inch) (M3)")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad15,5"), "iPad Air (13-inch) (M3)")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad16,8"), "iPad Air (11-inch) (M4)")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad16,10"), "iPad Air (13-inch) (M4)")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad16,1"), "iPad mini (A17 Pro)")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad17,1"), "iPad Pro (11-inch) (M5)")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad17,3"), "iPad Pro (13-inch) (M5)")
    }

    func testMapToDevice_shortensIPadProNames() {
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad8,1"), "iPad Pro (11-inch) (1st gen)")
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPad14,5"), "iPad Pro (12.9-inch) (6th gen)")
    }

    func testMapToDevice_returnsIdentifier_whenUnknown() {
        XCTAssertEqual(UIDevice.mapToDevice(identifier: "iPhone99,1"), "iPhone99,1")
    }
}
