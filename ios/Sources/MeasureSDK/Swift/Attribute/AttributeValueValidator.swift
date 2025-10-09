//
//  AttributeValueValidator.swift
//  Measure
//
//  Created by Adwin Ross on 09/10/25.
//

import Foundation

protocol AttributeValueValidator {
    func validateAttributes(name: String, attributes: [String: AttributeValue]?) -> Bool
}

final class BaseAttributeValueValidator: AttributeValueValidator {
    private let configProvider: ConfigProvider
    private let logger: Logger

    init(configProvider: ConfigProvider, logger: Logger) {
        self.configProvider = configProvider
        self.logger = logger
    }

    func validateAttributes(name: String, attributes: [String: AttributeValue]?) -> Bool {
        guard let attributes = attributes else {
            return true
        }

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
