//
//  AppLaunchEvents.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 12/11/24.
//

import Foundation

struct ColdLaunchData: Codable {
    let processStartUptime: UnsignedNumber?
    let processStartRequestedUptime: UnsignedNumber?
    let contentProviderAttachUptime: UnsignedNumber?
    let onNextDrawUptime: UnsignedNumber
    let launchedActivity: String
    let hasSavedState: Bool
    let intentData: String?

    enum CodingKeys: String, CodingKey {
        case processStartUptime = "process_start_uptime"
        case processStartRequestedUptime = "process_start_requested_uptime"
        case contentProviderAttachUptime = "content_provider_attach_uptime"
        case onNextDrawUptime = "on_next_draw_uptime"
        case launchedActivity = "launched_activity"
        case hasSavedState = "has_saved_state"
        case intentData = "intent_data"
    }
}

struct WarmLaunchData: Codable {
    let appVisibleUptime: UnsignedNumber?
    let onNextDrawUptime: UnsignedNumber
    let launchedActivity: String
    let hasSavedState: Bool
    let intentData: String?

    enum CodingKeys: String, CodingKey {
        case appVisibleUptime = "app_visible_uptime"
        case onNextDrawUptime = "on_next_draw_uptime"
        case launchedActivity = "launched_activity"
        case hasSavedState = "has_saved_state"
        case intentData = "intent_data"
    }
}

struct HotLaunchData: Codable {
    let appVisibleUptime: UnsignedNumber?
    let onNextDrawUptime: UnsignedNumber
    let launchedActivity: String
    let hasSavedState: Bool
    let intentData: String?

    enum CodingKeys: String, CodingKey {
        case appVisibleUptime = "app_visible_uptime"
        case onNextDrawUptime = "on_next_draw_uptime"
        case launchedActivity = "launched_activity"
        case hasSavedState = "has_saved_state"
        case intentData = "intent_data"
    }
}

struct LaunchData {
    let appVersion: String
    let timeSinceLastBoot: UnsignedNumber
}
