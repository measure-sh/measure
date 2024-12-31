//
//  CustomEventCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 24/12/24.
//

import Foundation

protocol CustomEventCollector {
    func enable()
    func disable()
    func trackEvent(name: String, timestamp: Number?)
}

final class BaseCustomEventCollector: CustomEventCollector {
    private let logger: Logger
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private let configProvider: ConfigProvider
    private var isEnabled = false
    private lazy var customEventNameRegex: NSRegularExpression? = {
        try? NSRegularExpression(pattern: configProvider.customEventNameRegex)
    }()

    init(logger: Logger, eventProcessor: EventProcessor, timeProvider: TimeProvider, configProvider: ConfigProvider) {
        self.logger = logger
        self.eventProcessor = eventProcessor
        self.timeProvider = timeProvider
        self.configProvider = configProvider
    }

    func enable() {
        isEnabled = true
    }

    func disable() {
        isEnabled = false
    }

    func trackEvent(name: String, timestamp: Number?) {
        guard isEnabled else { return }
        guard validateName(name) else { return }

        let data = CustomEventData(name: name)
        eventProcessor.track(data: data,
                             timestamp: timeProvider.now(),
                             type: .custom,
                             attributes: nil,
                             sessionId: nil,
                             attachments: nil)
    }

    private func validateName(_ name: String) -> Bool {
        if name.isEmpty {
            logger.log(level: .warning, message: "Event name is empty. This event will be dropped.", error: nil, data: nil)
            return false
        }

        if name.count > configProvider.maxEventNameLength {
            logger.log(level: .warning, message: "Event(\(name)) exceeded max allowed length. This event will be dropped.", error: nil, data: nil)
            return false
        }

        if let regex = customEventNameRegex,
           regex.firstMatch(in: name, options: [], range: NSRange(location: 0, length: name.count)) == nil {
            return false
        }

        return true
    }
}
