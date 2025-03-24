//
//  MockEventProcessor.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

final class MockEventProcessor: EventProcessor {
    var attachments: [Attachment]?
    var sessionId: String?
    var data: Codable?
    var timestamp: Number?
    var type: EventType?
    var attributes: Attributes?
    var userDefinedAttributes: String?

    func track<T>(data: T, // swiftlint:disable:this function_parameter_count
                  timestamp: Number,
                  type: EventType,
                  attributes: Attributes?,
                  sessionId: String?,
                  attachments: [Attachment]?,
                  userDefinedAttributes: String? = nil) where T: Codable {
        self.data = data
        self.timestamp = timestamp
        self.type = type
        self.attributes = attributes
        self.sessionId = sessionId
        self.attachments = attachments
        self.userDefinedAttributes = userDefinedAttributes
    }

    func trackUserTriggered<T>(data: T, // swiftlint:disable:this function_parameter_count
                               timestamp: Number,
                               type: EventType,
                               attributes: Attributes?,
                               sessionId: String?,
                               attachments: [Attachment]?,
                               userDefinedAttributes: String? = nil) where T: Codable {
        self.data = data
        self.timestamp = timestamp
        self.type = type
        self.attributes = attributes
        self.sessionId = sessionId
        self.attachments = attachments
        self.userDefinedAttributes = userDefinedAttributes
    }
}
