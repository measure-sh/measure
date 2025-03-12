//
//  EventType.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/09/24.
//

import Foundation

enum EventType: String, Codable {
    case exception
    case gestureClick = "gesture_click"
    case gestureLongClick = "gesture_long_click"
    case gestureScroll = "gesture_scroll"
    case lifecycleApp = "lifecycle_app"
    case lifecycleViewController = "lifecycle_view_controller"
    case lifecycleSwiftUI = "lifecycle_swift_ui"
    case cpuUsage = "cpu_usage"
    case memoryUsageAbsolute = "memory_usage_absolute"
    case coldLaunch = "cold_launch"
    case warmLaunch = "warm_launch"
    case hotLaunch = "hot_launch"
    case http
    case networkChange = "network_change"
    case custom
    case screenView = "screen_view"
}
