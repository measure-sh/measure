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
    func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Int64?)
}

final class BaseCustomEventCollector: CustomEventCollector {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let configProvider: ConfigProvider
    private var isEnabled = AtomicBool(false)
    private lazy var customEventNameRegex: NSRegularExpression? = {
        try? NSRegularExpression(pattern: configProvider.customEventNameRegex)
    }()

    init(logger: Logger, signalProcessor: SignalProcessor, timeProvider: TimeProvider, configProvider: ConfigProvider) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.configProvider = configProvider
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

    func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Int64?) {
        guard isEnabled.get() else { return }
        guard validateName(name) else { return }
        guard validateAttributes(name: name, attributes: attributes) else { return }

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

    private func validateAttributes(name: String, attributes: [String: AttributeValue]) -> Bool {
        if attributes.count > configProvider.maxUserDefinedAttributesPerEvent {
            logger.log(level: .warning, message: "Event(\(name)) contains more than max allowed attributes. This event will be dropped.", error: nil, data: nil)
            return false
        }

        return attributes.allSatisfy { key, value in
            let isKeyValid = validateKey(key)
            let isValueValid = validateValue(value)

            if !isKeyValid {
                logger.log(level: .warning, message: "Event(\(name)) contains invalid attribute key: \(key). This event will be dropped.", error: nil, data: nil)
            }
            if !isValueValid {
                logger.log(level: .warning, message: "Event(\(name)) contains invalid attribute value. This event will be dropped.", error: nil, data: nil)
            }

            return isKeyValid && isValueValid
        }
    }

    private func validateKey(_ key: String) -> Bool {
        return key.count <= configProvider.maxUserDefinedAttributeKeyLength
    }

    private func validateValue(_ value: AttributeValue) -> Bool {
        switch value {
        case .string(let stringValue):
            return stringValue.count <= configProvider.maxUserDefinedAttributeValueLength
        default:
            return true
        }
    }
}
