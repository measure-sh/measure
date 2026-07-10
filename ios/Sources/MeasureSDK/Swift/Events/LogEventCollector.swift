//
//  LogEventCollector.swift
//  Measure
//
//  Created by Abhay Sood on 11/06/26.
//

import Foundation

protocol LogEventCollector {
    func enable()
    func disable()
    func trackLog(body: String, severity: LogSeverity, attributes: [String: AttributeValue])
}

final class BaseLogEventCollector: LogEventCollector {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let configProvider: ConfigProvider
    private let attributeValueValidator: AttributeValueValidator
    private var isEnabled = AtomicBool(false)

    init(logger: Logger, signalProcessor: SignalProcessor, timeProvider: TimeProvider, configProvider: ConfigProvider, attributeValueValidator: AttributeValueValidator) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.attributeValueValidator = attributeValueValidator
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            logger.log(level: .info, message: "LogEventCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(level: .info, message: "LogEventCollector disabled.", error: nil, data: nil)
        }
    }

    func trackLog(body: String, severity: LogSeverity, attributes: [String: AttributeValue]) {
        guard isEnabled.get() else { return }
        guard !body.isEmpty else {
            logger.log(level: .warning, message: "LogEventCollector: Log message is empty. This event will be dropped.", error: nil, data: nil)
            return
        }
        guard severity.severityNumber >= configProvider.logMinSeverity else { return }
        guard !configProvider.shouldDiscardLog(body: body) else { return }
        guard attributeValueValidator.validateAttributes(name: "log", attributes: attributes) else { return }

        let data = LogData(severityText: severity.severityText,
                           severityNumber: severity.severityNumber,
                           body: String(body.prefix(Int(configProvider.maxLogBodyLength))))
        let userDefinedAttributes = EventSerializer.serializeUserDefinedAttribute(attributes)

        signalProcessor.trackUserTriggered(data: data,
                                           timestamp: timeProvider.now(),
                                           type: .log,
                                           attributes: nil,
                                           sessionId: nil,
                                           attachments: nil,
                                           userDefinedAttributes: userDefinedAttributes,
                                           threadName: nil,
                                           needsReporting: true)
    }
}
