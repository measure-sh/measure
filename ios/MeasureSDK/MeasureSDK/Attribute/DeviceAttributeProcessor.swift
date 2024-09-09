//
//  DeviceAttributeProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/09/24.
//

import Foundation
import UIKit

/// Generates the device attributes such as device name, model, manufacturer, and more. These attributes are expected to be constant during the session and are computed once.
final class DeviceAttributeProcessor: BaseComputeOnceAttributeProcessor {
    private var isComputed = false
    private var deviceName: String?
    private var deviceModel: String?
    private var deviceManufacturer: String?
    private var deviceType: DeviceType?
    private var deviceIsFoldable: Bool?
    private var deviceIsPhysical: Bool?
    private var deviceDensityDpi: Int64?
    private var deviceWidthPx: Int64?
    private var deviceHeightPx: Int64?
    private var deviceDensity: Int64?
    private var deviceLocale: String?
    private var osName: String?
    private var osVersion: String?
    private var platform: String?
    private var deviceCpuArch: String?

    override func updateAttribute(_ attribute: inout Attributes) {
        attribute.deviceName = deviceName
        attribute.deviceModel = deviceModel
        attribute.deviceManufacturer = deviceManufacturer
        attribute.deviceType = deviceType
        attribute.deviceIsFoldable = deviceIsFoldable
        attribute.deviceIsPhysical = deviceIsPhysical
        attribute.deviceDensityDpi = deviceDensityDpi
        attribute.deviceWidthPx = deviceWidthPx
        attribute.deviceHeightPx = deviceHeightPx
        attribute.deviceDensity = deviceDensity
        attribute.deviceLocale = deviceLocale
        attribute.osName = osName
        attribute.osVersion = osVersion
        attribute.platform = platform ?? AttributeConstants.platform
        attribute.deviceCpuArch = deviceCpuArch
    }

    override func computeAttributes() {
        deviceName = UIDevice.current.name
        deviceModel = UIDevice.modelName
        deviceManufacturer = AttributeConstants.deviceManufacturer
        deviceType = UIDevice.current.userInterfaceIdiom == .phone ? .phone : .tablet
        deviceIsFoldable = false
        deviceIsPhysical = TARGET_OS_SIMULATOR == 0
        deviceDensityDpi = Int64(UIScreen.main.scale * 160)
        deviceWidthPx = Int64(UIScreen.main.bounds.width * UIScreen.main.scale)
        deviceHeightPx = Int64(UIScreen.main.bounds.height * UIScreen.main.scale)
        deviceDensity = Int64(UIScreen.main.scale)
        deviceLocale = Locale.current.identifier
        osName = UIDevice.current.systemName
        osVersion = UIDevice.current.systemVersion
        platform = AttributeConstants.platform
        deviceCpuArch = getCPUArchitecture()
    }

    func getCPUArchitecture() -> String {
        var sysInfo = utsname()
        uname(&sysInfo)

        let machineMirror = Mirror(reflecting: sysInfo.machine)
        let identifier = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }

        return identifier
    }
}
