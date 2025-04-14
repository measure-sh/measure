//
//  InternalEventCollector.swift
//  Measure
//
//  Created by Abhay Sood on 11/04/25.
//

import Foundation

protocol InternalEventCollector {
    func enable()
    func disable()
    func trackEvent(
        data: [String: Any?], type: String, timestamp: Int64, attributes: [String: Any?],
        userDefinedAttrs: [String: AttributeValue], userTriggered: Bool, sessionId: String?, threadName: String?)
}

final class BaseInternalEventCollector: InternalEventCollector {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private var isEnabled = AtomicBool(false)

    init(logger: Logger, signalProcessor: SignalProcessor) {
        self.logger = logger
        self.signalProcessor = signalProcessor
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            logger.log(
                level: .info, message: "InternalEventCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(
                level: .info, message: "InternalEventCollector disabled.", error: nil, data: nil)
        }
    }

    func trackEvent(
        data: [String: Any?], type: String, timestamp: Int64, attributes: [String: Any?],
        userDefinedAttrs: [String: AttributeValue], userTriggered: Bool, sessionId: String?,
        threadName: String?
    ) {
        guard isEnabled.get() else {
            return
        }
            
        guard let platform = attributes["platform"] as? String else {
            logger.internalLog(level: .warning, message: "Platform not found in attributes, cannot process event", error: nil, data: nil)
            return
        }
        
        let evaluatedAttributes = Attributes(platform: platform)
        let serializedUserDefinedAttributes = EventSerializer.serializeUserDefinedAttribute(userDefinedAttrs)
        
        do {
            switch type {
            case EventType.custom.rawValue:
                let customEventData = try extractCustomEventData(data: data)
                signalProcessor.track(data: customEventData, timestamp: timestamp, type: EventType.custom, attributes: evaluatedAttributes, sessionId: sessionId, attachments: nil, userDefinedAttributes: serializedUserDefinedAttributes, threadName: threadName)
                
            default:
                logger.internalLog(level: .debug, message: "Unimplemented event type: $type", error: nil, data: nil)
            }
        } catch {
            logger.internalLog(level: .error, message: "Error processing event: \(error)", error: error, data: nil)
            return
        }
    }

    func extractCustomEventData(data: [String: Any?]) throws -> CustomEventData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(CustomEventData.self, from: jsonData)
    }
}
