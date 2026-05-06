//
//  AttributeTransformer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/05/26.
//

import Foundation

protocol AttributeTransformer {
    func transformAttributes(_ attributes: [String: Any]?) -> [String: AttributeValue]
}

final class BaseAttributeTransformer: AttributeTransformer {
    private let logger: Logger?

    init(logger: Logger? = nil) {
        self.logger = logger
    }

    func transformAttributes(_ attributes: [String: Any]?) -> [String: AttributeValue] {
        guard let attributes = attributes else {
            return [:]
        }

        var transformedAttributes: [String: AttributeValue] = [:]

        for (key, value) in attributes {
            if let boolVal = value as? Bool {
                transformedAttributes[key] = .boolean(boolVal)
            } else if let stringVal = value as? String {
                transformedAttributes[key] = .string(stringVal)
            } else if let intVal = value as? Int {
                transformedAttributes[key] = .int(intVal)
            } else if let longVal = value as? Int64 {
                transformedAttributes[key] = .long(longVal)
            } else if let floatVal = value as? Float {
                transformedAttributes[key] = .float(floatVal)
            } else if let doubleVal = value as? Double {
                transformedAttributes[key] = .double(doubleVal)
            } else {
                logger?.log(level: .fatal, message: "Attribute value can only be a string, boolean, integer, or double.", error: nil, data: nil)
            }
        }

        return transformedAttributes
    }
}
