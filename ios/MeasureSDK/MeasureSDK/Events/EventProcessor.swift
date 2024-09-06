//
//  EventProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/09/24.
//

import Foundation

/// A protocol for processing events. Responsible for tracking events, processing them by applying
/// various attributes and transformations, and then eventually storing them or sending them to the server.
protocol EventProcessor {
    /// Tracks an event with the given data, timestamp, and type.
    func track<T: Codable>(
        data: T,
        timestamp: Int64,
        type: EventType
    )

    /// Tracks an event with the given data, timestamp, type, and sessionId.
    func track<T: Codable>(
        data: T,
        timestamp: Int64,
        type: EventType,
        sessionId: String
    )

    /// Tracks an event with the given data, timestamp, type, attributes, and attachments.
    func track<T: Codable>(
        data: T,
        timestamp: Int64,
        type: EventType,
        attributes: Attributes?,
        attachments: [Attachment]
    )
}

/// A concrete implementation of the `EventProcessor` protocol, responsible for tracking and
/// processing events.
internal class BaseEventProcessor: EventProcessor {
    private let logger: Logger
    private let idProvider: IdProvider
    private let sessionManager: SessionManager
    private let attributeProcessors: [AttributeProcessor]
    private let configProvider: ConfigProvider
    private let systemTime: SystemTime

    init(
        logger: Logger,
        idProvider: IdProvider,
        sessionManager: SessionManager,
        attributeProcessors: [AttributeProcessor],
        configProvider: ConfigProvider,
        systemTime: SystemTime
    ) {
        self.logger = logger
        self.idProvider = idProvider
        self.sessionManager = sessionManager
        self.attributeProcessors = attributeProcessors
        self.configProvider = configProvider
        self.systemTime = systemTime
    }

    func track<T: Codable>(
        data: T,
        timestamp: Int64,
        type: EventType
    ) {
        track(data: data, timestamp: timestamp, type: type, attributes: Attributes(), attachments: [])
    }

    func track<T: Codable>(
        data: T,
        timestamp: Int64,
        type: EventType,
        sessionId: String
    ) {
        track(data: data, timestamp: timestamp, type: type, attributes: Attributes(), attachments: [], sessionId: sessionId)
    }

    func track<T: Codable>(
        data: T,
        timestamp: Int64,
        type: EventType,
        attributes: Attributes?,
        attachments: [Attachment]
    ) {
        track(data: data, timestamp: timestamp, type: type, attributes: attributes, attachments: attachments, sessionId: nil)
    }

    private func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Int64,
        type: EventType,
        attributes: Attributes?,
        attachments: [Attachment],
        sessionId: String?
    ) {
        let threadName = Thread.current.name ?? "unknown"
        let event = createEvent(
            data: data,
            timestamp: timestamp,
            type: type,
            attachments: attachments,
            attributes: attributes,
            userTriggered: false,
            sessionId: sessionId
        )
        event.attributes?.threadName = threadName
        event.appendAttributes(self.attributeProcessors)

        logger.log(level: .debug, message: "Event processed: \(type), \(event.sessionId)", error: nil)
    }

    private func createEvent<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Int64,
        type: EventType,
        attachments: [Attachment],
        attributes: Attributes?,
        userTriggered: Bool,
        sessionId: String?
    ) -> Event<T> {
        let id = idProvider.createId()
        let resolvedSessionId = sessionId ?? sessionManager.sessionId
        return Event(
            id: id,
            sessionId: resolvedSessionId,
            timestamp: systemTime.iso8601Timestamp(timeInMillis: timestamp),
            type: type,
            data: data,
            attachments: attachments,
            attributes: attributes,
            userTriggered: userTriggered
        )
    }
}
