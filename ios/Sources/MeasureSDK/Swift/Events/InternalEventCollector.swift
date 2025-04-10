//
//  InternalEventCollector.swift
//  Pods
//
//  Created by Abhay Sood on 10/04/25.
//

import Foundation

protocol InternalEventCollector {
    func enable()
    func disable()
    func trackEvent<T: Codable>(
        data: T,
        type: EventType,
        timestamp: Number,
        attributes: Attributes,
        userDefinedAttrs: String,
        attachments: [Attachment],
        userTriggered: Bool,
        sessionId: String?
    )
}

final class BaseInternalEventCollector: InternalEventCollector {
    private let logger: Logger
    private let eventProcessor: EventProcessor
    private var isEnabled = AtomicBool(false)
    
    init(logger: Logger, eventProcessor: EventProcessor) {
        self.logger = logger
        self.eventProcessor = eventProcessor
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            logger.log(level: .info, message: "InternalEventCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(level: .info, message: "InternalEventCollector disabled.", error: nil, data: nil)
        }
    }

    func trackEvent<T: Codable>(
        data: T,
        type: EventType,
        timestamp: Number,
        attributes: Attributes,
        userDefinedAttrs: String,
        attachments: [Attachment],
        userTriggered: Bool,
        sessionId: String?
    ) {
        if (attributes.platform.isEmpty) {
            logger.log(level: .info, message: "Missing platform attribute in event \(type)", error: nil, data: nil)
            return
        }
        logger.log(level: .info, message:  "Event(\(type)) received from platform(\(attributes.platform))", error: nil, data: nil)
        
        if (userTriggered) {
            eventProcessor.trackUserTriggered(
                data: data,
                timestamp: timestamp,
                type: type,
                attributes: attributes,
                sessionId: sessionId,
                attachments: attachments,
                userDefinedAttributes: userDefinedAttrs)
        } else {
            eventProcessor.track(
                data: data,
                timestamp: timestamp,
                type: type,
                attributes: attributes,
                sessionId: sessionId,
                attachments: attachments,
                userDefinedAttributes: userDefinedAttrs)
        }
    }
}
