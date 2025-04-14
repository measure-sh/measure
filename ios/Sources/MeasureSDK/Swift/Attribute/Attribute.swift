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
}
