//
//  Event.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/08/24.
//

import Foundation

struct Event: Codable {
    
    /// UUID of the event
    let id: String
    
    /// The type of the event.
    let type: String
    
    /// UUID of the session
    let sessionId: String
    
    /// Nanosecond precision timestamp
    let timestamp: String
    
    /// True, when the event is triggered by SDK consumer.
    let userTriggered: Bool?
    
    /// Event attributes
    let attributes: Attribute
    
    /// Attachments for the event. Must be an array of attachment objects. Represent with emtpy array if there are no attachments.
    let attachments: [Attachment]
    
    /// An optional Exception object
    let exception: Exception?
    
    init(id: String,
         type: String,
         sessionId: String,
         timestamp: String,
         userTriggered: Bool?,
         attributes: Attribute,
         attachments: [Attachment] = [Attachment](),
         exception: Exception? = nil
    ) {
        self.id = id
        self.type = type
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.userTriggered = userTriggered
        self.attributes = attributes
        self.attachments = attachments
        self.exception = exception
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case type
        case sessionId = "session_id"
        case timestamp
        case userTriggered = "user_triggered"
        case attributes
        case attachments
        case exception
    }
    
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try values.decode(String.self, forKey: .id)
        type = try values.decode(String.self, forKey: .type)
        sessionId = try values.decode(String.self, forKey: .sessionId)
        timestamp = try values.decode(String.self, forKey: .timestamp)
        userTriggered = try values.decodeIfPresent(Bool.self, forKey: .userTriggered)
        attributes = try values.decode(Attribute.self, forKey: .attributes)
        attachments = try values.decode([Attachment].self, forKey: .attachments)
        exception = try values.decodeIfPresent(Exception.self, forKey: .exception)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(type, forKey: .type)
        try container.encode(sessionId, forKey: .sessionId)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encodeIfPresent(userTriggered, forKey: .userTriggered)
        try container.encode(attributes, forKey: .attributes)
        try container.encode(attachments, forKey: .attachments)
        try container.encode(exception, forKey: .exception)
    }
}
