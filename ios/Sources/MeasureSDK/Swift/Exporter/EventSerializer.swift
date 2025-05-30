//
//  EventSerializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/10/24.
//

import Foundation

struct EventSerializer {
    func getSerialisedEvent(for eventEntity: EventEntity) -> Data? { // swiftlint:disable:this cyclomatic_complexity
        guard let type = EventType(rawValue: eventEntity.type) else {
            print("Failed to encode event. Unknown event type: \(eventEntity.type)")
            return nil
        }

        let eventType: Codable.Type

        switch type {
        case .exception:
            eventType = Exception.self
        case .gestureClick:
            eventType = ClickData.self
        case .gestureLongClick:
            eventType = LongClickData.self
        case .gestureScroll:
            eventType = ScrollData.self
        case .lifecycleApp:
            eventType = ApplicationLifecycleData.self
        case .lifecycleViewController:
            eventType = VCLifecycleData.self
        case .lifecycleSwiftUI:
            eventType = SwiftUILifecycleData.self
        case .cpuUsage:
            eventType = CpuUsageData.self
        case .memoryUsageAbsolute:
            eventType = MemoryUsageData.self
        case .coldLaunch:
            eventType = ColdLaunchData.self
        case .warmLaunch:
            eventType = WarmLaunchData.self
        case .hotLaunch:
            eventType = HotLaunchData.self
        case .http:
            eventType = HttpData.self
        case .networkChange:
            eventType = NetworkChangeData.self
        case .custom:
            eventType = CustomEventData.self
        case .screenView:
            eventType = ScreenViewData.self
        case .bugReport:
            eventType = BugReportData.self
        }

        // Call the generic helper function
        return serialiseEvent(eventEntity, as: eventType)
    }

    private func serialiseEvent<T: Codable>(_ eventEntity: EventEntity, as type: T.Type) -> Data? {
        let event: Event<T> = eventEntity.getEvent()

        let encoder = JSONEncoder()
        return try? encoder.encode(event)
    }

    static func serializeUserDefinedAttribute(_ userDefinedAttribute: [String: AttributeValue]?) -> String? {
        guard let userDefinedAttribute = userDefinedAttribute else { return nil }

        let converted: [String: Any] = userDefinedAttribute.mapValues { $0.value }

        if let data = try? JSONSerialization.data(withJSONObject: converted, options: [.sortedKeys]),
           let jsonString = String(data: data, encoding: .utf8) {
            return jsonString
        }

        return nil
    }
}
