//
//  InternalSignalCollector.swift
//  Measure
//
//  Created by Abhay Sood on 11/04/25.
//

import Foundation

protocol InternalSignalCollector {
    func enable()
    func disable()
    // swiftlint:disable:next function_parameter_count
    func trackEvent(
        data: inout [String: Any?], type: String, timestamp: Int64, attributes: [String: Any?],
        userDefinedAttrs: [String: AttributeValue], userTriggered: Bool, sessionId: String?, threadName: String?)
    var isForeground: Bool { get set }
}

final class BaseInternalSignalCollector: InternalSignalCollector {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private var isEnabled = AtomicBool(false)
    var isForeground: Bool

    init(logger: Logger, signalProcessor: SignalProcessor) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.isForeground = true
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

    // swiftlint:disable:next function_parameter_count function_body_length
    func trackEvent(
        data: inout [String: Any?], type: String, timestamp: Int64, attributes: [String: Any?],
        userDefinedAttrs: [String: AttributeValue], userTriggered: Bool, sessionId: String?,
        threadName: String?
    ) {
        guard isEnabled.get() else {
            return
        }

        let evaluatedAttributes = Attributes()
        let serializedUserDefinedAttributes = EventSerializer.serializeUserDefinedAttribute(
            userDefinedAttrs)

        do {
            switch type {
            case EventType.custom.rawValue:
                let customEventData = try extractCustomEventData(data: data)
                signalProcessor.track(
                    data: customEventData,
                    timestamp: timestamp,
                    type: EventType.custom,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: nil,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName)
            case EventType.exception.rawValue:
                // adding foreground property to the exception data here
                // as we don't want to add duplicate logic in Flutter/RN
                // to find out whether the app is in foreground or not.
                if data.keys.contains("foreground") {
                    data["foreground"] = isForeground
                } else {
                    logger.log(
                        level: .debug,
                        message: "invalid exception event, missing foreground property",
                        error: nil,
                        data: nil)
                }
                let exceptionData = try extractExceptionData(data: data)
                signalProcessor.track(
                    data: exceptionData,
                    timestamp: timestamp,
                    type: EventType.exception,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: nil,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName)
            case EventType.screenView.rawValue:
                let screenViewData = try extractScreenViewData(data: data)
                signalProcessor.track(
                    data: screenViewData,
                    timestamp: timestamp,
                    type: EventType.screenView,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: nil,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName)
            case EventType.http.rawValue:
                let httpData = try extractHttpData(data: data)
                signalProcessor.track(
                    data: httpData,
                    timestamp: timestamp,
                    type: EventType.http,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: nil,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName)
            default:
                logger.log(
                    level: .debug,
                    message: "Unimplemented event type: $type",
                    error: nil,
                    data: nil)
            }
        } catch {
            logger.log(
                level: .error,
                message: "Error processing event: \(error)",
                error: error,
                data: nil)
            return
        }
    }

    func extractCustomEventData(data: [String: Any?]) throws -> CustomEventData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(CustomEventData.self, from: jsonData)
    }

    func extractExceptionData(data: [String: Any?]) throws -> Exception {
        let jsonData = try JSONSerialization.data(
            withJSONObject: data,
            options: [.prettyPrinted])
        return try JSONDecoder().decode(Exception.self, from: jsonData)
    }

    func extractScreenViewData(data: [String: Any?]) throws -> ScreenViewData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(ScreenViewData.self, from: jsonData)
    }

    func extractHttpData(data: [String: Any?]) throws -> HttpData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(HttpData.self, from: jsonData)
    }
}
