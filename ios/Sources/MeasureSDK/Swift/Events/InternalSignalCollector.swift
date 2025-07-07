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
        data: inout [String: Any?],
        type: String,
        timestamp: Int64,
        attributes: [String: Any?],
        userDefinedAttrs: [String: AttributeValue],
        userTriggered: Bool,
        sessionId: String?,
        threadName: String?,
        attachments: [MsrAttachment]
    )

    func trackSpan( // swiftlint:disable:this function_parameter_count
        name: String,
        traceId: String,
        spanId: String,
        parentId: String?,
        startTime: Int64,
        endTime: Int64,
        duration: Int64,
        status: Int64,
        attributes: [String: Any?],
        userDefinedAttrs: [String: AttributeValue],
        checkpoints: [String: Int64],
        hasEnded: Bool,
        isSampled: Bool
    )

    var isForeground: Bool { get set }
}

// Recieves events and spans from cross platform frameworks and
// sends them to the `SignalProcessor` for being stored.
final class BaseInternalSignalCollector: InternalSignalCollector {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let sessionManager: SessionManager
    private let attributeProcessors: [AttributeProcessor]

    private var isEnabled = AtomicBool(false)
    var isForeground: Bool

    init(logger: Logger,
         timeProvider: TimeProvider,
         signalProcessor: SignalProcessor,
         sessionManager: SessionManager,
         attributeProcessors: [AttributeProcessor]) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.sessionManager = sessionManager
        self.timeProvider = timeProvider
        self.attributeProcessors = attributeProcessors
        self.isForeground = true
    }

    // Enables the collector
    func enable() {
        isEnabled.setTrueIfFalse {
            logger.log(level: .info, message: "InternalEventCollector enabled.", error: nil, data: nil)
        }
    }

    // Disables the collector
    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(level: .info, message: "InternalEventCollector disabled.", error: nil, data: nil)
        }
    }

    // Tracks an event.
    //
    // swiftlint:disable:next function_parameter_count function_body_length
    func trackEvent(
        data: inout [String: Any?],
        type: String,
        timestamp: Int64,
        attributes: [String: Any?],
        userDefinedAttrs: [String: AttributeValue],
        userTriggered: Bool,
        sessionId: String?,
        threadName: String?,
        attachments: [MsrAttachment]
    ) {
        guard isEnabled.get() else { return }

        let evaluatedAttributes = Attributes()
        let serializedUserDefinedAttributes = EventSerializer.serializeUserDefinedAttribute(userDefinedAttrs)

        do {
            switch type {
            case EventType.custom.rawValue:
                let customEventData = try extractCustomEventData(data: data)
                signalProcessor.track(
                    data: customEventData,
                    timestamp: timestamp,
                    type: .custom,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: nil,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName
                )

            case EventType.exception.rawValue:
                // Adding foreground property to the exception data here
                if data.keys.contains("foreground") {
                    data["foreground"] = isForeground
                } else {
                    logger.log(
                        level: .debug,
                        message: "Invalid exception event, missing foreground property",
                        error: nil,
                        data: nil
                    )
                }
                let exceptionData = try extractExceptionData(data: data)
                signalProcessor.track(
                    data: exceptionData,
                    timestamp: timestamp,
                    type: .exception,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: nil,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName
                )

            case EventType.screenView.rawValue:
                let screenViewData = try extractScreenViewData(data: data)
                signalProcessor.track(
                    data: screenViewData,
                    timestamp: timestamp,
                    type: .screenView,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: nil,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName
                )

            case EventType.http.rawValue:
                let httpData = try extractHttpData(data: data)
                signalProcessor.track(
                    data: httpData,
                    timestamp: timestamp,
                    type: .http,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: nil,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName
                )

            case EventType.bugReport.rawValue:
                let bugReportData = try extractBugReportData(data: data)
                sessionManager.markCurrentSessionAsCrashed()
                signalProcessor.track(
                    data: bugReportData,
                    timestamp: timestamp,
                    type: .bugReport,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: attachments,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName
                )
            case EventType.gestureClick.rawValue:
                let bugReportData = try extractClickData(data: data)
                signalProcessor.track(
                    data: bugReportData,
                    timestamp: timestamp,
                    type: .gestureClick,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: attachments,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName
                )
            case EventType.gestureLongClick.rawValue:
                let bugReportData = try extractLongClickData(data: data)
                signalProcessor.track(
                    data: bugReportData,
                    timestamp: timestamp,
                    type: .gestureLongClick,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: attachments,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName
                )
            case EventType.gestureScroll.rawValue:
                let bugReportData = try extractScrollData(data: data)
                signalProcessor.track(
                    data: bugReportData,
                    timestamp: timestamp,
                    type: .gestureScroll,
                    attributes: evaluatedAttributes,
                    sessionId: sessionId,
                    attachments: attachments,
                    userDefinedAttributes: serializedUserDefinedAttributes,
                    threadName: threadName
                )
            default:
                logger.log(
                    level: .debug,
                    message: "Unimplemented event type: \(type)",
                    error: nil,
                    data: nil
                )
            }
        } catch {
            logger.log(
                level: .error,
                message: "Error processing event: \(error)",
                error: error,
                data: nil
            )
        }
    }

    // Tracks a span.
    //
    // Spans from cross platform frameworks do not contain session ID and
    // only contain a few attributes. This function applies the session ID
    // and remaining attributes to the span to construct SpanData object.
    func trackSpan( // swiftlint:disable:this function_parameter_count
        name: String,
        traceId: String,
        spanId: String,
        parentId: String?,
        startTime: Int64,
        endTime: Int64,
        duration: Int64,
        status: Int64,
        attributes: [String: Any?],
        userDefinedAttrs: [String: AttributeValue],
        checkpoints: [String: Int64],
        hasEnded: Bool,
        isSampled: Bool
    ) {
        guard isEnabled.get() else { return }

        // get session
        let sessionId = sessionManager.sessionId

        // apply attributes
        var parsedAttributes = Attributes(dict: attributes)
        for attributeProcessor in attributeProcessors {
            attributeProcessor.appendAttributes(&parsedAttributes)
        }

        // deserialize checkpoints
        let parsedCheckpoints: [Checkpoint] = checkpoints.compactMap { entry in
            return Checkpoint(
                name: entry.key,
                timestamp: timeProvider.iso8601Timestamp(timeInMillis: entry.value)
            )
        }

        let spanData = SpanData(
            name: name,
            traceId: traceId,
            spanId: spanId,
            parentId: parentId,
            sessionId: sessionId,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            status: SpanStatus(rawValue: status) ?? .unset,
            attributes: parsedAttributes,
            userDefinedAttrs: userDefinedAttrs,
            checkpoints: parsedCheckpoints,
            hasEnded: hasEnded,
            isSampled: isSampled
        )

        signalProcessor.trackSpan(spanData)
    }

    func extractCustomEventData(data: [String: Any?]) throws -> CustomEventData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(CustomEventData.self, from: jsonData)
    }

    func extractExceptionData(data: [String: Any?]) throws -> Exception {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [.prettyPrinted])
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
    
    func extractBugReportData(data: [String: Any?]) throws -> BugReportData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(BugReportData.self, from: jsonData)
    }
    
    func extractClickData(data: [String: Any?]) throws -> ClickData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(ClickData.self, from: jsonData)
    }
    
    func extractLongClickData(data: [String: Any?]) throws -> LongClickData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(LongClickData.self, from: jsonData)
    }
    
    func extractScrollData(data: [String: Any?]) throws -> ScrollData {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        return try JSONDecoder().decode(ScrollData.self, from: jsonData)
    }
}
