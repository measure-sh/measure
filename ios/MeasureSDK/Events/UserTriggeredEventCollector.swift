//
//  UserTriggeredEventCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 08/01/25.
//

import Foundation

protocol UserTriggeredEventCollector {
    func trackScreenView(_ screenName: String)
    func enable()
    func disable()
}

final class BaseUserTriggeredEventCollector: UserTriggeredEventCollector {
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private var isEnabled = false

    init(eventProcessor: EventProcessor, timeProvider: TimeProvider) {
        self.eventProcessor = eventProcessor
        self.timeProvider = timeProvider
    }

    func enable() {
        isEnabled = true
    }

    func disable() {
        isEnabled = false
    }

    func trackScreenView(_ screenName: String) {
        guard isEnabled else { return }

        let data = ScreenViewData(name: screenName)
        eventProcessor.trackUserTriggered(data: data,
                                          timestamp: timeProvider.now(),
                                          type: .screenView,
                                          attributes: nil,
                                          sessionId: nil,
                                          attachments: nil,
                                          userDefinedAttributes: nil)
    }
}
