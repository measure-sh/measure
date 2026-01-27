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
        attachments: [MsrAttachment]?,
        userDefinedAttributes: String?,
        threadName: String?,
        needsReporting: Bool?)

    func trackUserTriggered<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        sessionId: String?,
        attachments: [MsrAttachment]?,
        userDefinedAttributes: String?,
        threadName: String?,
        needsReporting: Bool?)

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
    private let signalStore: SignalStore
    private let measureDispatchQueue: MeasureDispatchQueue
    private let signalSampler: SignalSampler
    private let exporter: Exporter

    init(logger: Logger,
         idProvider: IdProvider,
         sessionManager: SessionManager,
         attributeProcessors: [AttributeProcessor],
         configProvider: ConfigProvider,
         timeProvider: TimeProvider,
         crashDataPersistence: CrashDataPersistence,
         signalStore: SignalStore,
         measureDispatchQueue: MeasureDispatchQueue,
         signalSampler: SignalSampler,
         exporter: Exporter) {
        self.logger = logger
        self.idProvider = idProvider
        self.sessionManager = sessionManager
        self.attributeProcessors = attributeProcessors
        self.configProvider = configProvider
        self.timeProvider = timeProvider
        self.crashDataPersistence = crashDataPersistence
        self.signalStore = signalStore
        self.measureDispatchQueue = measureDispatchQueue
        self.signalSampler = signalSampler
        self.exporter = exporter
    }

    func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        sessionId: String?,
        attachments: [MsrAttachment]?,
        userDefinedAttributes: String?,
        threadName: String?,
        needsReporting: Bool?) {
        SignPost.trace(subcategory: "Event", label: "trackEvent") {
            track(data: data,
                  timestamp: timestamp,
                  type: type,
                  attributes: attributes,
                  userTriggered: false,
                  attachments: attachments,
                  sessionId: sessionId,
                  userDefinedAttributes: userDefinedAttributes,
                  threadName: threadName,
                  needsReporting: needsReporting)
        }
    }

    func trackUserTriggered<T: Codable>( // swiftlint:disable:this function_parameter_count
                                        data: T,
                                        timestamp: Number,
                                        type: EventType,
                                        attributes: Attributes?,
                                        sessionId: String?,
                                        attachments: [MsrAttachment]?,
                                        userDefinedAttributes: String?,
                                        threadName: String?,
                                        needsReporting: Bool?) {
        SignPost.trace(subcategory: "Event", label: "trackEventUserTriggered") {
            track(data: data,
                  timestamp: timestamp,
                  type: type,
                  attributes: attributes,
                  userTriggered: true,
                  attachments: attachments,
                  sessionId: sessionId,
                  userDefinedAttributes: userDefinedAttributes,
                  threadName: threadName,
                  needsReporting: needsReporting)
        }
    }

    func trackSpan(_ spanData: SpanData) {
        SignPost.trace(subcategory: "Span", label: "trackSpanTriggered") {
            trackSpanData(spanData)
        }
    }

    private func trackSpanData(_ spanData: SpanData) {
        measureDispatchQueue.submit { [weak self] in
            guard let self else { return }
            if !spanData.isSampled {
                // Do not store spans that are not sampled
                return
            }
            let spanEntity = SpanEntity(spanData,
                                        startTimeString: timeProvider.iso8601Timestamp(timeInMillis: spanData.startTime),
                                        endTimeString: timeProvider.iso8601Timestamp(timeInMillis: spanData.endTime))
            signalStore.store(spanEntity)
            logger.log(level: .debug, message: "Span processed: \(spanData.name), spanId: \(spanData.spanId), duration: \(spanData.duration)", error: nil, data: nil)
        }
    }

    private func track<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attributes: Attributes?,
        userTriggered: Bool,
        attachments: [MsrAttachment]?,
        sessionId: String?,
        userDefinedAttributes: String?,
        threadName: String?,
        needsReporting: Bool?
    ) {
        let resolvedThreadName = threadName ?? OperationQueue.current?.underlyingQueue?.label ?? "unknown"

        measureDispatchQueue.submit { [weak self] in
            guard let self else { return }

            let event = self.createEvent(
                data: data,
                timestamp: timestamp,
                type: type,
                attachments: attachments,
                attributes: attributes ?? Attributes(),
                userTriggered: userTriggered,
                sessionId: sessionId,
                userDefinedAttributes: userDefinedAttributes
            )

            self.appendAttributes(event: event, threadName: resolvedThreadName.isEmpty ? "unknown" : resolvedThreadName)

            self.signalStore.store(event,
                                   needsReporting: configProvider.enableFullCollectionMode ? true : needsReporting ?? false)
            self.sessionManager.onEventTracked(event)
            if event.type == .bugReport {
                self.exporter.export()
            }

            self.logger.log(level: .debug, message: "Event processed: \(type), \(event.id)", error: nil, data: data)
        }
    }

    private func appendAttributes<T: Codable>(event: Event<T>, threadName: String?) {
        SignPost.trace(subcategory: "Event", label: "appendAttributes") {
            event.attributes?.threadName = threadName
            event.attributes?.deviceLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
            event.appendAttributes(self.attributeProcessors)
            if let attributes = event.attributes {
                self.crashDataPersistence.attribute = attributes
            }
        }
    }
    private func createEvent<T: Codable>( // swiftlint:disable:this function_parameter_count
        data: T,
        timestamp: Number,
        type: EventType,
        attachments: [MsrAttachment]?,
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
