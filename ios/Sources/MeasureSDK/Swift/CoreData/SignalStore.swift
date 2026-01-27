//
//  SignalStore.swift
//  Measure
//
//  Created by Adwin Ross on 15/01/26.
//

import Foundation

protocol SignalStore {
    func store<T: Codable>(_ event: Event<T>, needsReporting: Bool)
    func store(_ span: SpanEntity)
}

final class BaseSignalStore: SignalStore {
    private let eventStore: EventStore
    private let spanStore: SpanStore
    private let sessionStore: SessionStore
    private let logger: Logger
    private let config: ConfigProvider

    init(eventStore: EventStore,
         spanStore: SpanStore,
         sessionStore: SessionStore,
         logger: Logger,
         config: ConfigProvider) {
        self.eventStore = eventStore
        self.spanStore = spanStore
        self.sessionStore = sessionStore
        self.logger = logger
        self.config = config
    }

    func store<T: Codable>(_ event: Event<T>, needsReporting: Bool) {
        let eventEntity = EventEntity(event, needsReporting: needsReporting)

        var isCrashEvent = false
        if let exception = event.exception, !exception.handled {
            isCrashEvent = true
        }
        let isBugReportEvent = event.type == .bugReport
        let isHighPriority = isCrashEvent || isBugReportEvent

        eventStore.insertEvent(event: eventEntity)
        if isHighPriority {
            let timelineDuration: Number
            if isCrashEvent {
                timelineDuration = config.crashTimelineDurationSeconds
            } else {
                timelineDuration = config.bugReportTimelineDurationSeconds
            }

            eventStore.markTimelineForReporting(eventTimestampMillis: eventEntity.timestampInMillis,
                                                durationSeconds: timelineDuration,
                                                sessionId: eventEntity.sessionId)

            return
        }
    }

    func store(_ span: SpanEntity) {
        guard span.isSampled else { return }

        spanStore.insertSpan(span: span)
    }
}
