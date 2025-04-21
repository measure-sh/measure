//
//  SignalProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/09/24.
//

import Foundation

/// A protocol for processing events. Responsible for tracking events, processing them by applying
/// various attributes and transformations, and then eventually storing them or sending them to the server.
protocol SignalProcessor {
    /// Tracks an event with the given data, timestamp, type, attributes, sessionId and attachments.
    func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        sessionId: String?,
        attachments: [Attachment]?,
        userDefinedAttributes: String?)

    func trackUserTriggered<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        sessionId: String?,
        attachments: [Attachment]?,
        userDefinedAttributes: String?)

    func trackSpan(_ spanData: SpanData)
}

/// A concrete implementation of the `SignalProcessor` protocol, responsible for tracking and
/// processing events.
final class BaseSignalProcessor: SignalProcessor {
    private let logger: Logger
    private let idProvider: IdProvider
    private let sessionManager: SessionManager
    private let attributeProcessors: [AttributeProcessor]
    private let configProvider: ConfigProvider
    private let timeProvider: TimeProvider
    private var crashDataPersistence: CrashDataPersistence
    private let eventStore: EventStore
    private let spanStore: SpanStore

    init(logger: Logger,
         idProvider: IdProvider,
         sessionManager: SessionManager,
         attributeProcessors: [AttributeProcessor],
         configProvider: ConfigProvider,
         timeProvider: TimeProvider,
         crashDataPersistence: CrashDataPersistence,
         eventStore: EventStore,
         spanStore: SpanStore) {
        self.logger = logger
        self.idProvider = idProvider
        self.sessionManager = sessionManager
        self.attributeProcessors = attributeProcessors
        self.configProvider = configProvider
        self.timeProvider = timeProvider
        self.crashDataPersistence = crashDataPersistence
        self.eventStore = eventStore
        self.spanStore = spanStore
    }

    func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        sessionId: String?,
        attachments: [Attachment]?,
        userDefinedAttributes: String?) {
        SignPost.trace(label: "track-event") {
            track(data: data,
                  timestamp: timestamp,
                  type: type,
                  attributes: attributes,
                  userTriggered: false,
                  attachments: attachments,
                  sessionId: sessionId,
                  userDefinedAttributes: userDefinedAttributes)
        }
    }

    func trackUserTriggered<T: Codable>( // swiftlint:disable:this function_parameter_count
                                        data: T,
                                        timestamp: Number,
                                        type: EventType,
                                        attributes: Attributes?,
                                        sessionId: String?,
                                        attachments: [Attachment]?,
                                        userDefinedAttributes: String?) {
        SignPost.trace(label: "track-event-user-triggered") {
            track(data: data,
                  timestamp: timestamp,
                  type: type,
                  attributes: attributes,
                  userTriggered: true,
                  attachments: attachments,
                  sessionId: sessionId,
                  userDefinedAttributes: userDefinedAttributes)
        }
    }

    func trackSpan(_ spanData: SpanData) {
        SignPost.trace(label: "track-span-triggered") {
            trackSpanData(spanData)
        }
    }

    private func trackSpanData(_ spanData: SpanData) {
        let spanEntity = SpanEntity(spanData,
                                    startTimeString: timeProvider.iso8601Timestamp(timeInMillis: spanData.startTime),
                                    endTimeString: timeProvider.iso8601Timestamp(timeInMillis: spanData.endTime))
        spanStore.insertSpan(span: spanEntity)
        logger.log(level: .debug, message: "Span processed: \(spanData.name), spanId: \(spanData.spanId), duration: \(spanData.duration)", error: nil, data: nil)
    }

    private func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        userTriggered: Bool,
        attachments: [Attachment]?,
        sessionId: String?,
        userDefinedAttributes: String?
    ) {
        let threadName = OperationQueue.current?.underlyingQueue?.label ?? "unknown"
        let event = createEvent(
            data: data,
            timestamp: timestamp,
            type: type,
            attachments: attachments,
            attributes: attributes ?? Attributes(),
            userTriggered: userTriggered,
            sessionId: sessionId,
            userDefinedAttributes: userDefinedAttributes
        )
        event.attributes?.threadName = threadName
        event.attributes?.deviceLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
        event.appendAttributes(self.attributeProcessors)
        if let attributes = event.attributes {
            self.crashDataPersistence.attribute = attributes
        }
        let needsReporting = sessionManager.shouldReportSession ? true : configProvider.eventTypeExportAllowList.contains(event.type)
        let eventEntity = EventEntity(event, needsReporting: needsReporting)
        eventStore.insertEvent(event: eventEntity)
        sessionManager.onEventTracked(eventEntity)
        logger.log(level: .debug, message: "Event processed: \(type), \(event.id)", error: nil, data: data)
    }

    private func createEvent<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attachments: [Attachment]?,
        attributes: Attributes?,
        userTriggered: Bool,
        sessionId: String?,
        userDefinedAttributes: String?
    ) -> Event<T> {
        let id = idProvider.uuid()
        let resolvedSessionId = sessionId ?? sessionManager.sessionId
        return Event(
            id: id,
            sessionId: resolvedSessionId,
            timestamp: timeProvider.iso8601Timestamp(timeInMillis: timestamp),
            timestampInMillis: timestamp,
            type: type,
            data: data,
            attachments: attachments,
            attributes: attributes,
            userTriggered: userTriggered,
            userDefinedAttributes: userDefinedAttributes
        )
    }
}
