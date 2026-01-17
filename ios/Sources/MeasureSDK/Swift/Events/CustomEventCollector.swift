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
    func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Number?)
}

final class BaseCustomEventCollector: CustomEventCollector {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let configProvider: ConfigProvider
    private var isEnabled = AtomicBool(false)
    private let customEventNameRegex: NSRegularExpression?
    private let attributeValueValidator: AttributeValueValidator

    init(logger: Logger, signalProcessor: SignalProcessor, timeProvider: TimeProvider, configProvider: ConfigProvider, attributeValueValidator: AttributeValueValidator) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.attributeValueValidator = attributeValueValidator
        do {
            self.customEventNameRegex = try NSRegularExpression(pattern: configProvider.customEventNameRegex)
        } catch {
            self.customEventNameRegex = nil
            logger.log(level: .error, message: "Failed to create NSRegularExpression", error: error, data: nil)
        }
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            logger.log(level: .info, message: "CustomEventCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(level: .info, message: "CustomEventCollector disabled.", error: nil, data: nil)
        }
    }

    func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Number?) {
        guard isEnabled.get() else { return }
        guard validateName(name) else { return }
        guard attributeValueValidator.validateAttributes(name: name, attributes: attributes) else { return }

        let data = CustomEventData(name: name)
        let userDefinedAttributes = EventSerializer.serializeUserDefinedAttribute(attributes)

        signalProcessor.trackUserTriggered(data: data,
                                           timestamp: timestamp ?? timeProvider.now(),
                                           type: .custom,
                                           attributes: nil,
                                           sessionId: nil,
                                           attachments: nil,
                                           userDefinedAttributes: userDefinedAttributes,
                                           threadName: nil)
    }

    private func validateName(_ name: String) -> Bool {
        if name.isEmpty {
            logger.log(level: .warning, message: "Event name is empty. This event will be dropped.", error: nil, data: nil )
            return false
        }

        if name.count > configProvider.maxEventNameLength {
            logger.log(level: .warning, message: "Event(\(name)) exceeded max allowed length. This event will be dropped.", error: nil, data: nil)
            return false
        }

        if let regex = customEventNameRegex,
           regex.firstMatch(in: name, options: [], range: NSRange(location: 0, length: name.count)) == nil {
            logger.log(level: .warning, message: "Event(\(name)) does not match the allowed pattern. This event will be dropped.", error: nil, data: nil)
            return false
        }

        return true
    }
}
