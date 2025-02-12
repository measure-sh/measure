//
//  AttributeConvertor.swift
//  measure_flutter
//
//  Created by Abhay Sood on 12/02/25.
//

import Foundation

class AttributeConverter {
    static func convertAttributes(_ attributes: [String: Any]) throws -> [String: AttributeValue] {
        var convertedAttributes: [String: AttributeValue] = [:]
        
        for (key, value) in attributes {
            do {
                convertedAttributes[key] = try convert(value: value, forKey: key)
            } catch {
                throw MethodArgumentError(
                    code: MethodConstants.errorInvalidAttribute,
                    message: "Failed to convert attribute '\(key)'",
                    details: error.localizedDescription
                )
            }
        }
        
        return convertedAttributes
    }
    
    private static func convert(value: Any, forKey key: String) throws -> AttributeValue {
        switch value {
        case let stringValue as String:
            return .string(stringValue)
        case let boolValue as Bool:
            return .boolean(boolValue)
        case let intValue as Int:
            return .int(intValue)
        case let int64Value as Int64:
            return .long(int64Value)
        case let floatValue as Float:
            return .float(floatValue)
        case let doubleValue as Double:
            return .double(doubleValue)
        default:
            throw MethodArgumentError(
                code: MethodConstants.errorInvalidAttribute,
                message: "Invalid attribute type for key '\(key)'",
                details: "Supported types: String, Boolean, Int, Int64, Float, Double"
            )
        }
    }
}
