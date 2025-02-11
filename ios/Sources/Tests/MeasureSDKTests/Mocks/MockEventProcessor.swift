//
//  MockEventProcessor.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockEventProcessor: EventProcessor {
    var attachments: [MeasureSDK.Attachment]?
    var sessionId: String?
    var data: Codable?
    var timestamp: MeasureSDK.Number?
    var type: MeasureSDK.EventType?
    var attributes: MeasureSDK.Attributes?
    var userDefinedAttributes: String?

    func track<T>(data: T, // swiftlint:disable:this function_parameter_count
                  timestamp: MeasureSDK.Number,
                  type: MeasureSDK.EventType,
                  attributes: MeasureSDK.Attributes?,
                  sessionId: String?,
                  attachments: [MeasureSDK.Attachment]?,
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
                               timestamp: MeasureSDK.Number,
                               type: MeasureSDK.EventType,
                               attributes: MeasureSDK.Attributes?,
                               sessionId: String?,
                               attachments: [MeasureSDK.Attachment]?,
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
