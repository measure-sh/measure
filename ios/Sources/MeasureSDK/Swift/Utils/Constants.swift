//
//  Constants.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 06/09/24.
//

import Foundation

typealias Number = Int64
typealias UnsignedNumber = UInt64
typealias FloatNumber32 = Float32
typealias FloatNumber64 = Float64

let logTag = "com.measure.sh"
let cacheDirectoryName = "com.measure.sh"
let crashDataFileName = "crash_data.txt"
let backgroundQueueLabel = "com.measure.background"
let periodicEventExporterLabel = "com.measure.periodicEventExporter"
let userInitiatedQueueLabel = "com.measure.userInitiated"
let eventsEndpoint = "events"
let multipartBoundry = "--boundary-7MA4YWxkTrZu0gW"
let authorization = "Authorization"
let bearer = "Bearer"
let msrRequestId = "msr-req-id"
let formFieldEvent = "event"
let formFieldSpan = "span"
let suiteName = "com.measure.sh"
let userIdKey = "user_id"
let eTagKey = "config_etag"
let installationIdKey = "installation_id"
let recentEventTrackedTimestamp = "latest_event_tracked_timestamp"
let recentSessionIdKey = "recent_session_id"
let recentSessionEventTimeKey = "recent_session_event_time"
let recentSessionCreatedAtKey = "recent_session_created_at"
let recentSessionCrashedKey = "recent_session_crashed_key"
let recentSessionVersionCodeKey = "recent_session_version_code"
let recentLaunchAppVersion = "recent_launch_app_version"
let recentLaunchTimeSinceLastBoot = "recent_launch_time_since_last_boot"
let networkInterceptorHandledKey = "NetworkInterceptorHandled"
let screenshotName = "screenshot.png"
let galleryImageName = "galleryImage.png"
let layoutSnapshotName = "layoutSnapshot.svg"
let layoutSnapshotDirectoryName = "layoutSnapshot"
let fallbackApiUrl = "http://fallback"
let recentAppVersion = "recentAppVersion"
let recentAppBuildNumber = "recentAppBuildNumber"
let screenshotContentType = "image/png"
let layoutSnapshotContentType = "image/svg+xml"

struct AttributeConstants {
    static let deviceManufacturer = "Apple"
    static let platform = "ios"
    static let unknown = "unknown"
}

struct CrashDataKeys {
    static let threadName = "thread_name"
    static let deviceName = "device_name"
    static let deviceModel = "device_model"
    static let deviceManufacturer = "device_manufacturer"
    static let deviceType = "device_type"
    static let deviceIsFoldable = "device_is_foldable"
    static let deviceIsPhysical = "device_is_physical"
    static let deviceDensityDpi = "device_density_dpi"
    static let deviceWidthPx = "device_width_px"
    static let deviceHeightPx = "device_height_px"
    static let deviceDensity = "device_density"
    static let deviceLocale = "device_locale"
    static let osName = "os_name"
    static let osVersion = "os_version"
    static let platform = "platform"
    static let networkType = "network_type"
    static let networkGeneration = "network_generation"
    static let networkProvider = "network_provider"
    static let installationId = "installation_id"
    static let userId = "user_id"
    static let deviceCpuArch = "device_cpu_arch"
    static let appVersion = "app_version"
    static let appBuild = "app_build"
    static let measureSdkVersion = "measure_sdk_version"
    static let appUniqueId = "app_unique_id"
    static let sessionId = "session_id"
    static let isForeground = "is_foreground"
}
