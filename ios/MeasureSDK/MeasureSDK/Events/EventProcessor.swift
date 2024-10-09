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
    /// Tracks an event with the given data, timestamp, type, attributes, sessionId and attachments.
    func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        sessionId: String?,
        attachments: [Attachment]?
    )
}

extension EventProcessor {
    func track<T: Codable>(
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes? = nil,
        sessionId: String? = nil,
        attachments: [Attachment]? = nil
    ) {
        track(data: data,
              timestamp: timestamp,
              type: type,
              attributes: attributes,
              sessionId: sessionId,
              attachments: attachments)
    }
}

/// A concrete implementation of the `EventProcessor` protocol, responsible for tracking and
/// processing events.
final class BaseEventProcessor: EventProcessor {
    private let logger: Logger
    private let idProvider: IdProvider
    private let sessionManager: SessionManager
    private let attributeProcessors: [AttributeProcessor]
    private let configProvider: ConfigProvider
    private let systemTime: SystemTime
    private var crashDataPersistence: CrashDataPersistence
    private let eventStore: EventStore

    init(
        logger: Logger,
        idProvider: IdProvider,
        sessionManager: SessionManager,
        attributeProcessors: [AttributeProcessor],
        configProvider: ConfigProvider,
        systemTime: SystemTime,
        crashDataPersistence: CrashDataPersistence,
        eventStore: EventStore
    ) {
        self.logger = logger
        self.idProvider = idProvider
        self.sessionManager = sessionManager
        self.attributeProcessors = attributeProcessors
        self.configProvider = configProvider
        self.systemTime = systemTime
        self.crashDataPersistence = crashDataPersistence
        self.eventStore = eventStore
    }

    func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        sessionId: String?,
        attachments: [Attachment]?
    ) {
        track(data: data, timestamp: timestamp, type: type, attributes: attributes, attachments: attachments, sessionId: sessionId)
    }

    private func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        attachments: [Attachment]?,
        sessionId: String?
    ) {
        let threadName = ((Thread.current.name?.isEmpty) != nil) ? "unknown" : Thread.current.name
        let event = createEvent(
            data: data,
            timestamp: timestamp,
            type: type,
            attachments: attachments,
            attributes: attributes ?? Attributes(),
            userTriggered: false,
            sessionId: sessionId
        )
        event.attributes?.threadName = threadName
        event.appendAttributes(self.attributeProcessors)
        if let attributes = event.attributes {
            self.crashDataPersistence.attribute = attributes
        }

        eventStore.insertEvent(event: EventEntity(event))
        logger.log(level: .debug, message: "Event processed: \(type), \(event.id) \(data)", error: nil)
    }

    private func createEvent<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attachments: [Attachment]?,
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
