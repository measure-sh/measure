//
//  Event.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/09/24.
//

import Foundation

/// Represents an event in Measure. This object maps closely to the event object in the Measure API.
final class Event<T: Codable>: Codable {
    /// A unique identifier for the event.
    let id: String

    /// The session id of the event. This is the session id of the session in which the event was triggered.
    let sessionId: String

    /// The timestamp of the event. The time when the event was triggered, measured in milliseconds since epoch.
    let timestamp: String

    /// The timestamp of the event in milliseconds.
    let timestampInMillis: Number?

    /// The type of the event.
    let type: EventType

    /// Attachments that can be added to the event.
    var attachments: [Attachment]?

    /// Additional key-value pairs that can be added to the event.
    var attributes: Attributes?

    /// A flag to indicate if the event is triggered by the user or the SDK.
    let userTriggered: Bool

    /// Attributes set by the user in the event. The type of values in the map is set to Any here, however, the allowed values can only be String, Int, Long, Double, Float or Boolean.
    let userDefinedAttributes: String?

    /// Data related to Exception
    let exception: Exception?

    /// Data related to a click gesture event.
    let gestureClick: ClickData?

    /// Data related to a long click gesture event.
    let gestureLongClick: LongClickData?

    /// Data related to a scroll gesture event.
    let gestureScroll: ScrollData?

    /// Data related to the application's lifecycle events.
    let lifecycleApp: ApplicationLifecycleData?

    /// Data related to view controller lifecycle events.
    let lifecycleViewController: VCLifecycleData?

    /// Data related to SwiftUI lifecycle events.
    let lifecycleSwiftUI: SwiftUILifecycleData?

    /// Data representing CPU usage at the time of the event.
    let cpuUsage: CpuUsageData?

    /// Data representing absolute memory usage at the time of the event.
    let memoryUsageAbsolute: MemoryUsageData?

    /// Data related to cold application launches.
    let coldLaunch: ColdLaunchData?

    /// Data related to warm application launches.
    let warmLaunch: WarmLaunchData?

    /// Data related to hot application launches.
    let hotLaunch: HotLaunchData?

    /// Data related to HTTP requests made during the event.
    let http: HttpData?

    /// Data representing network connectivity changes.
    let networkChange: NetworkChangeData?

    /// Custom event data added by the user.
    let custom: CustomEventData?

    /// Data related to screen view events.
    let screenView: ScreenViewData?

    init(id: String,
         sessionId: String,
         timestamp: String,
         timestampInMillis: Number,
         type: EventType,
         data: T?,
         attachments: [Attachment]?,
         attributes: Attributes?,
         userTriggered: Bool,
         userDefinedAttributes: String? = nil) {
        self.id = id
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.timestampInMillis = timestampInMillis
        self.type = type
        self.attachments = attachments
        self.attributes = attributes
        self.userTriggered = userTriggered
        self.userDefinedAttributes = userDefinedAttributes
        self.exception = data as? Exception
        self.gestureClick = data as? ClickData
        self.gestureLongClick = data as? LongClickData
        self.gestureScroll = data as? ScrollData
        self.lifecycleApp = data as? ApplicationLifecycleData
        self.lifecycleViewController = data as? VCLifecycleData
        self.lifecycleSwiftUI = data as? SwiftUILifecycleData
        self.cpuUsage = data as? CpuUsageData
        self.memoryUsageAbsolute = data as? MemoryUsageData
        self.coldLaunch = data as? ColdLaunchData
        self.warmLaunch = data as? WarmLaunchData
        self.hotLaunch = data as? HotLaunchData
        self.http = data as? HttpData
        self.networkChange = data as? NetworkChangeData
        self.custom = data as? CustomEventData
        self.screenView = data as? ScreenViewData
    }

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case timestamp
        case type
        case attachments
        case attributes = "attribute"
        case userTriggered = "user_triggered"
        case timestampInMillis
        case userDefinedAttributes = "user_defined_attributes"
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

    /// Appends additional attributes to the event using the provided attribute processors.
    /// - Parameter attributeProcessors: A list of processors that modify the event's attributes.
    func appendAttributes(_ attributeProcessors: [AttributeProcessor]) {
        attributeProcessors.forEach { processor in
            processor.appendAttributes(&self.attributes!)
        }
    }
}
