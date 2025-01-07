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

    /// The data collected. This can be any object that conforms to `Codable`.
    let data: T?

    /// Attachments that can be added to the event.
    var attachments: [Attachment]?

    /// Additional key-value pairs that can be added to the event.
    var attributes: Attributes?

    /// A flag to indicate if the event is triggered by the user or the SDK.
    let userTriggered: Bool

    /// Attributes set by the user in the event. The type of values in the map is set to Any here, however, the allowed values can only be String, Int, Long, Double, Float or Boolean.
    let userDefinedAttributes: String?

    init(id: String,
         sessionId: String,
         timestamp: String,
         timestampInMillis: Number,
         type: EventType, data: T?,
         attachments: [Attachment]?,
         attributes: Attributes?,
         userTriggered: Bool,
         userDefinedAttributes: String? = nil) {
        self.id = id
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.type = type
        self.data = data
        self.attachments = attachments
        self.attributes = attributes
        self.userTriggered = userTriggered
        self.timestampInMillis = timestampInMillis
        self.userDefinedAttributes = userDefinedAttributes
    }

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case timestamp
        case type
        case data
        case attachments
        case attributes
        case userTriggered = "user_triggered"
        case timestampInMillis
        case userDefinedAttributes = "user_defined_attributes"
    }

    func appendAttributes(_ attributeProcessors: [AttributeProcessor]) {
        attributeProcessors.forEach { processor in
            processor.appendAttributes(&self.attributes!)
        }
    }
}
