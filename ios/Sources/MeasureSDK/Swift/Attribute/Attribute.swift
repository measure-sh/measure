//
//  Attribute.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation

enum NetworkGeneration: String, Codable {
    case generation2 = "2g"
    case generation3 = "3g"
    case generation4 = "4g"
    case generation5 = "5g"
    case unknown = "unknown"
}

enum NetworkType: String, Codable {
    case noNetwork = "no_network"
    case cellular = "cellular"
    case wifi = "wifi"
    case vpn = "vpn"
    case unknown = "unknown"
}

enum DeviceType: String, Codable {
    case tablet
    case phone
}

struct Attributes: Codable {
    var threadName: String?
    var deviceName: String?
    var deviceModel: String?
    var deviceManufacturer: String?
    var deviceType: DeviceType?
    var deviceIsFoldable: Bool?
    var deviceIsPhysical: Bool?
    var deviceDensityDpi: Number?
    var deviceWidthPx: Number?
    var deviceHeightPx: Number?
    var deviceDensity: Number?
    var deviceLocale: String?
    var osName: String?
    var osVersion: String?
    var platform: String = AttributeConstants.platform
    var networkType: NetworkType?
    var networkGeneration: NetworkGeneration?
    var networkProvider: String?
    var installationId: String = ""
    var userId: String?
    var deviceCpuArch: String?
    var appVersion: String = ""
    var appBuild: String = ""
    var measureSdkVersion: String = ""
    var appUniqueId: String = ""
    var deviceThermalThrottlingEnabled: Bool?
    var deviceLowPowerMode: Bool?
    var osPageSize: UInt8?

    enum CodingKeys: String, CodingKey {
        case threadName = "thread_name"
        case deviceName = "device_name"
        case deviceModel = "device_model"
        case deviceManufacturer = "device_manufacturer"
        case deviceType = "device_type"
        case deviceIsFoldable = "device_is_foldable"
        case deviceIsPhysical = "device_is_physical"
        case deviceDensityDpi = "device_density_dpi"
        case deviceWidthPx = "device_width_px"
        case deviceHeightPx = "device_height_px"
        case deviceDensity = "device_density"
        case deviceLocale = "device_locale"
        case osName = "os_name"
        case osVersion = "os_version"
        case platform = "platform"
        case networkType = "network_type"
        case networkGeneration = "network_generation"
        case networkProvider = "network_provider"
        case installationId = "installation_id"
        case userId = "user_id"
        case deviceCpuArch = "device_cpu_arch"
        case appVersion = "app_version"
        case appBuild = "app_build"
        case measureSdkVersion = "measure_sdk_version"
        case appUniqueId = "app_unique_id"
        case osPageSize = "os_page_size"
        case deviceThermalThrottlingEnabled = "device_thermal_throttling_enabled"
        case deviceLowPowerMode = "device_low_power_mode"
    }

    init(
        threadName: String? = nil,
        deviceName: String? = nil,
        deviceModel: String? = nil,
        deviceManufacturer: String? = nil,
        deviceType: DeviceType? = nil,
        deviceIsFoldable: Bool? = nil,
        deviceIsPhysical: Bool? = nil,
        deviceDensityDpi: Number? = nil,
        deviceWidthPx: Number? = nil,
        deviceHeightPx: Number? = nil,
        deviceDensity: Number? = nil,
        deviceLocale: String? = nil,
        osName: String? = nil,
        osVersion: String? = nil,
        platform: String = AttributeConstants.platform,
        networkType: NetworkType? = nil,
        networkGeneration: NetworkGeneration? = nil,
        networkProvider: String? = nil,
        installationId: String = "",
        userId: String? = nil,
        deviceCpuArch: String? = nil,
        appVersion: String = "",
        appBuild: String = "",
        measureSdkVersion: String = "",
        appUniqueId: String = "",
        deviceThermalThrottlingEnabled: Bool? = nil,
        deviceLowPowerMode: Bool? = nil,
        osPageSize: UInt8? = nil) {
           self.threadName = threadName
           self.deviceName = deviceName
           self.deviceModel = deviceModel
           self.deviceManufacturer = deviceManufacturer
           self.deviceType = deviceType
           self.deviceIsFoldable = deviceIsFoldable
           self.deviceIsPhysical = deviceIsPhysical
           self.deviceDensityDpi = deviceDensityDpi
           self.deviceWidthPx = deviceWidthPx
           self.deviceHeightPx = deviceHeightPx
           self.deviceDensity = deviceDensity
           self.deviceLocale = deviceLocale
           self.osName = osName
           self.osVersion = osVersion
           self.platform = platform
           self.networkType = networkType
           self.networkGeneration = networkGeneration
           self.networkProvider = networkProvider
           self.installationId = installationId
           self.userId = userId
           self.deviceCpuArch = deviceCpuArch
           self.appVersion = appVersion
           self.appBuild = appBuild
           self.measureSdkVersion = measureSdkVersion
           self.appUniqueId = appUniqueId
           self.deviceThermalThrottlingEnabled = deviceThermalThrottlingEnabled
           self.deviceLowPowerMode = deviceLowPowerMode
           self.osPageSize = osPageSize
    }

    init(dict: [String: Any?]) {
        self.threadName = dict["threadName"] as? String
        self.deviceName = dict["deviceName"] as? String
        self.deviceModel = dict["deviceModel"] as? String
        self.deviceManufacturer = dict["deviceManufacturer"] as? String
        self.deviceType = (dict["deviceType"] as? String).flatMap(DeviceType.init)
        self.deviceIsFoldable = dict["deviceIsFoldable"] as? Bool
        self.deviceIsPhysical = dict["deviceIsPhysical"] as? Bool
        self.deviceDensityDpi = dict["deviceDensityDpi"] as? Number
        self.deviceWidthPx = dict["deviceWidthPx"] as? Number
        self.deviceHeightPx = dict["deviceHeightPx"] as? Number
        self.deviceDensity = dict["deviceDensity"] as? Number
        self.deviceLocale = dict["deviceLocale"] as? String
        self.osName = dict["osName"] as? String
        self.osVersion = dict["osVersion"] as? String
        self.platform = dict["platform"] as? String ?? AttributeConstants.platform
        self.networkType = (dict["networkType"] as? String).flatMap(NetworkType.init)
        self.networkGeneration = (dict["networkGeneration"] as? String).flatMap(NetworkGeneration.init)
        self.networkProvider = dict["networkProvider"] as? String
        self.installationId = dict["installationId"] as? String ?? ""
        self.userId = dict["userId"] as? String
        self.deviceCpuArch = dict["deviceCpuArch"] as? String
        self.appVersion = dict["appVersion"] as? String ?? ""
        self.appBuild = dict["appBuild"] as? String ?? ""
        self.measureSdkVersion = dict["measureSdkVersion"] as? String ?? ""
        self.appUniqueId = dict["appUniqueId"] as? String ?? ""
        self.deviceThermalThrottlingEnabled = dict["deviceThermalThrottlingEnabled"] as? Bool
        self.deviceLowPowerMode = dict["deviceLowPowerMode"] as? Bool
        self.osPageSize = dict["osPageSize"] as? UInt8
    }
}
