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

class Attributes: Codable {
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
    var networkType: NetworkType?
    var networkGeneration: NetworkGeneration?
    var networkProvider: String?
    var installationId: String = ""
    var userId: String?
    var patchId: String?
    var patchVersion: String?
    var deviceCpuArch: String?
    var appVersion: String = ""
    var appBuild: String = ""
    var measureSdkVersion: String = ""
    var appUniqueId: String = ""
    var deviceThermalThrottlingEnabled: Bool?
    var deviceLowPowerMode: Bool?
    var osPageSize: UInt8?
    var sessionStartTime: String?
    var expoUpdateId: String?
    var expoRuntimeVersion: String?
    var isExpoEmbeddedLaunch: Bool?
    var isExpoUsingEmbeddedAssets: Bool?
    var expoAutomaticUpdatePolicy: String?
    var expoExecutionEnvironment: String?
    var expoVersion: String?
    var expoSdkVersion: String?
    var expoEasProjectId: String?

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
        case networkType = "network_type"
        case networkGeneration = "network_generation"
        case networkProvider = "network_provider"
        case installationId = "installation_id"
        case userId = "user_id"
        case patchId = "patch_id"
        case patchVersion = "patch_version"
        case deviceCpuArch = "device_cpu_arch"
        case appVersion = "app_version"
        case appBuild = "app_build"
        case measureSdkVersion = "measure_sdk_version"
        case appUniqueId = "app_unique_id"
        case osPageSize = "os_page_size"
        case deviceThermalThrottlingEnabled = "device_thermal_throttling_enabled"
        case deviceLowPowerMode = "device_low_power_mode"
        case sessionStartTime = "session_start_time"
        case expoUpdateId = "expo_update_id"
        case expoRuntimeVersion = "expo_runtime_version"
        case isExpoEmbeddedLaunch = "is_expo_embedded_launch"
        case isExpoUsingEmbeddedAssets = "is_expo_using_embedded_assets"
        case expoAutomaticUpdatePolicy = "expo_automatic_update_policy"
        case expoExecutionEnvironment = "expo_execution_environment"
        case expoVersion = "expo_version"
        case expoSdkVersion = "expo_sdk_version"
        case expoEasProjectId = "expo_eas_project_id"
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
        networkType: NetworkType? = nil,
        networkGeneration: NetworkGeneration? = nil,
        networkProvider: String? = nil,
        installationId: String = "",
        userId: String? = nil,
        patchId: String? = nil,
        patchVersion: String? = nil,
        deviceCpuArch: String? = nil,
        appVersion: String = "",
        appBuild: String = "",
        measureSdkVersion: String = "",
        appUniqueId: String = "",
        deviceThermalThrottlingEnabled: Bool? = nil,
        deviceLowPowerMode: Bool? = nil,
        osPageSize: UInt8? = nil,
        sessionStartTime: String? = nil,
        expoUpdateId: String? = nil,
        expoRuntimeVersion: String? = nil,
        isExpoEmbeddedLaunch: Bool? = nil,
        isExpoUsingEmbeddedAssets: Bool? = nil,
        expoAutomaticUpdatePolicy: String? = nil,
        expoExecutionEnvironment: String? = nil,
        expoVersion: String? = nil,
        expoSdkVersion: String? = nil,
        expoEasProjectId: String? = nil) {
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
           self.networkType = networkType
           self.networkGeneration = networkGeneration
           self.networkProvider = networkProvider
           self.installationId = installationId
           self.userId = userId
           self.patchId = patchId
           self.patchVersion = patchVersion
           self.deviceCpuArch = deviceCpuArch
           self.appVersion = appVersion
           self.appBuild = appBuild
           self.measureSdkVersion = measureSdkVersion
           self.appUniqueId = appUniqueId
           self.deviceThermalThrottlingEnabled = deviceThermalThrottlingEnabled
           self.deviceLowPowerMode = deviceLowPowerMode
           self.osPageSize = osPageSize
           self.sessionStartTime = sessionStartTime
           self.expoUpdateId = expoUpdateId
           self.expoRuntimeVersion = expoRuntimeVersion
           self.isExpoEmbeddedLaunch = isExpoEmbeddedLaunch
           self.isExpoUsingEmbeddedAssets = isExpoUsingEmbeddedAssets
           self.expoAutomaticUpdatePolicy = expoAutomaticUpdatePolicy
           self.expoExecutionEnvironment = expoExecutionEnvironment
           self.expoVersion = expoVersion
           self.expoSdkVersion = expoSdkVersion
           self.expoEasProjectId = expoEasProjectId
    }

    init(dict: [String: Any?]) {
        self.threadName = dict["thread_name"] as? String
        self.deviceName = dict["device_name"] as? String
        self.deviceModel = dict["device_model"] as? String
        self.deviceManufacturer = dict["device_manufacturer"] as? String
        self.deviceType = (dict["device_type"] as? String).flatMap(DeviceType.init)
        self.deviceIsFoldable = dict["device_is_foldable"] as? Bool
        self.deviceIsPhysical = dict["device_is_physical"] as? Bool
        self.deviceDensityDpi = dict["device_density_dpi"] as? Number
        self.deviceWidthPx = dict["device_width_px"] as? Number
        self.deviceHeightPx = dict["device_height_px"] as? Number
        self.deviceDensity = dict["device_density"] as? Number
        self.deviceLocale = dict["device_locale"] as? String
        self.osName = dict["os_name"] as? String
        self.osVersion = dict["os_version"] as? String
        self.networkType = (dict["network_type"] as? String).flatMap(NetworkType.init)
        self.networkGeneration = (dict["network_generation"] as? String).flatMap(NetworkGeneration.init)
        self.networkProvider = dict["network_provider"] as? String
        self.installationId = dict["installation_id"] as? String ?? ""
        self.userId = dict["user_id"] as? String
        self.patchId = dict["patch_id"] as? String
        self.patchVersion = dict["patch_version"] as? String
        self.deviceCpuArch = dict["device_cpu_arch"] as? String
        self.appVersion = dict["app_version"] as? String ?? ""
        self.appBuild = dict["app_build"] as? String ?? ""
        self.measureSdkVersion = dict["measure_sdk_version"] as? String ?? ""
        self.appUniqueId = dict["app_unique_id"] as? String ?? ""
        self.deviceThermalThrottlingEnabled = dict["device_thermal_throttling_enabled"] as? Bool
        self.deviceLowPowerMode = dict["device_low_power_mode"] as? Bool
        self.osPageSize = dict["os_page_size"] as? UInt8
        self.sessionStartTime = dict["session_start_time"] as? String
        self.expoUpdateId = dict["expo_update_id"] as? String
        self.expoRuntimeVersion = dict["expo_runtime_version"] as? String
        self.isExpoEmbeddedLaunch = dict["is_expo_embedded_launch"] as? Bool
        self.isExpoUsingEmbeddedAssets = dict["is_expo_using_embedded_assets"] as? Bool
        self.expoAutomaticUpdatePolicy = dict["expo_automatic_update_policy"] as? String
        self.expoExecutionEnvironment = dict["expo_execution_environment"] as? String
        self.expoVersion = dict["expo_version"] as? String
        self.expoSdkVersion = dict["expo_sdk_version"] as? String
        self.expoEasProjectId = dict["expo_eas_project_id"] as? String
    }
}
