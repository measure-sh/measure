//
//  EventEntity.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/09/24.
//

import Foundation

struct EventEntity {
    let id: String
    let sessionId: String
    let timestamp: String
    let type: String
    let exception: Data?
    let attachments: [MsrAttachment]?
    let attributes: Data?
    let userDefinedAttributes: String?
    let gestureClick: Data?
    let gestureLongClick: Data?
    let gestureScroll: Data?
    let lifecycleApp: Data?
    let lifecycleViewController: Data?
    let lifecycleSwiftUI: Data?
    let cpuUsage: Data?
    let memoryUsage: Data?
    let coldLaunch: Data?
    let warmLaunch: Data?
    let hotLaunch: Data?
    let networkChange: Data?
    let screenView: Data?
    let userTriggered: Bool
    let timestampInMillis: Number
    var batchId: String?
    let http: Data?
    let customEvent: Data?
    var needsReporting: Bool
    let bugReport: Data?
    let sessionStartData: Data?
    let log: Data?

    private static let encoder = JSONEncoder()
    private static func encode<V: Encodable>(_ value: V?) -> Data? {
        guard let value else { return nil }
        do {
            return try encoder.encode(value)
        } catch {
            return nil
        }
    }

    private static let decoder = JSONDecoder()
    private static func decode<V: Decodable>(_ type: V.Type, from data: Data?) -> V? {
        guard let data else { return nil }
        do {
            return try decoder.decode(type, from: data)
        } catch {
            return nil
        }
    }

    init<T: Codable>(_ event: Event<T>, needsReporting: Bool) {
        self.id = event.id
        self.sessionId = event.sessionId
        self.timestamp = event.timestamp
        self.type = event.type.rawValue
        self.userTriggered = event.userTriggered
        self.timestampInMillis = event.timestampInMillis
        self.batchId = nil
        self.userDefinedAttributes = event.userDefinedAttributes
        self.needsReporting = needsReporting
        self.attachments = event.attachments

        self.exception = Self.encode(event.exception)
        self.gestureClick = Self.encode(event.gestureClick)
        self.gestureLongClick = Self.encode(event.gestureLongClick)
        self.gestureScroll = Self.encode(event.gestureScroll)
        self.lifecycleApp = Self.encode(event.lifecycleApp)
        self.lifecycleViewController = Self.encode(event.lifecycleViewController)
        self.lifecycleSwiftUI = Self.encode(event.lifecycleSwiftUI)
        self.cpuUsage = Self.encode(event.cpuUsage)
        self.memoryUsage = Self.encode(event.memoryUsageAbsolute)
        self.coldLaunch = Self.encode(event.coldLaunch)
        self.warmLaunch = Self.encode(event.warmLaunch)
        self.hotLaunch = Self.encode(event.hotLaunch)
        self.http = Self.encode(event.http)
        self.networkChange = Self.encode(event.networkChange)
        self.customEvent = Self.encode(event.custom)
        self.screenView = Self.encode(event.screenView)
        self.attributes = Self.encode(event.attributes)
        self.bugReport = Self.encode(event.bugReport)
        self.sessionStartData = event.type == .sessionStart ? Self.encode(SessionStartData()) : nil
        self.log = Self.encode(event.log)
    }

    init(id: String,
         sessionId: String,
         timestamp: String,
         type: String,
         exception: Data?,
         attachments: [MsrAttachment]?,
         attributes: Data?,
         userDefinedAttributes: String?,
         gestureClick: Data?,
         gestureLongClick: Data?,
         gestureScroll: Data?,
         userTriggered: Bool,
         timestampInMillis: Number,
         batchId: String?,
         lifecycleApp: Data?,
         lifecycleViewController: Data?,
         lifecycleSwiftUI: Data?,
         cpuUsage: Data?,
         memoryUsage: Data?,
         coldLaunch: Data?,
         warmLaunch: Data?,
         hotLaunch: Data?,
         http: Data?,
         networkChange: Data?,
         customEvent: Data?,
         screenView: Data?,
         bugReport: Data?,
         sessionStartData: Data?,
         log: Data?,
         needsReporting: Bool) {
        self.id = id
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.type = type
        self.exception = exception
        self.attachments = attachments
        self.attributes = attributes
        self.userDefinedAttributes = userDefinedAttributes
        self.userTriggered = userTriggered
        self.gestureClick = gestureClick
        self.gestureLongClick = gestureLongClick
        self.gestureScroll = gestureScroll
        self.timestampInMillis = timestampInMillis
        self.batchId = batchId
        self.lifecycleApp = lifecycleApp
        self.lifecycleViewController = lifecycleViewController
        self.lifecycleSwiftUI = lifecycleSwiftUI
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.coldLaunch = coldLaunch
        self.warmLaunch = warmLaunch
        self.hotLaunch = hotLaunch
        self.http = http
        self.networkChange = networkChange
        self.customEvent = customEvent
        self.screenView = screenView
        self.needsReporting = needsReporting
        self.bugReport = bugReport
        self.sessionStartData = sessionStartData
        self.log = log
    }

    /// Returns the encoded payload `Data` for the event's `type`, or `nil` for an unknown type.
    private var payloadData: Data? {
        switch EventType(rawValue: type) {
        case .exception: return exception
        case .gestureClick: return gestureClick
        case .gestureLongClick: return gestureLongClick
        case .gestureScroll: return gestureScroll
        case .lifecycleApp: return lifecycleApp
        case .lifecycleViewController: return lifecycleViewController
        case .lifecycleSwiftUI: return lifecycleSwiftUI
        case .cpuUsage: return cpuUsage
        case .memoryUsageAbsolute: return memoryUsage
        case .coldLaunch: return coldLaunch
        case .warmLaunch: return warmLaunch
        case .hotLaunch: return hotLaunch
        case .http: return http
        case .networkChange: return networkChange
        case .custom: return customEvent
        case .log: return log
        case .screenView: return screenView
        case .bugReport: return bugReport
        case .sessionStart: return sessionStartData
        case nil: return nil
        }
    }

    func getEvent<T: Codable>() -> Event<T> {
        let decodedData = Self.decode(T.self, from: payloadData)
        let decodedAttributes = Self.decode(Attributes.self, from: self.attributes)

        return Event(id: self.id,
                     sessionId: self.sessionId,
                     timestamp: self.timestamp,
                     timestampInMillis: self.timestampInMillis,
                     type: EventType(rawValue: self.type) ?? .exception,
                     data: decodedData,
                     attachments: attachments,
                     attributes: decodedAttributes,
                     userTriggered: self.userTriggered,
                     userDefinedAttributes: self.userDefinedAttributes)
    }
}
