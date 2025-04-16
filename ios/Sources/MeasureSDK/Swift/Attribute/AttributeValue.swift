//
//  AttributeValue.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/01/25.
//

import Foundation

/// Represents a value of an attribute. It can be a string, boolean, integer, or double.
public enum AttributeValue {
    case string(String)
    case boolean(Bool)
    case int(Int)
    case long(Int64)
    case float(Float)
    case double(Double)

    /// Returns the underlying value as `Any`.
    var value: Any {
        switch self {
        case .string(let value): return value
        case .boolean(let value): return value
        case .int(let value): return value
        case .long(let value): return value
        case .float(let value): return value
        case .double(let value): return value
        }
    }

    func serialize() -> Any {
        switch self {
        case .string(let stringValue):
            return "\"\(stringValue)\""
        default:
            return self.value
        }
    }
}

/// Serializer for `AttributeValue` to handle encoding and decoding.
enum AttributeValueSerializer {
    static func serialize(_ value: AttributeValue) -> Any {
        switch value {
        case .string(let stringValue):
            return "\"\(stringValue)\""
        default:
            return value.value
        }
    }

    static func deserialize(from value: Any) -> AttributeValue? {
        if let stringValue = value as? String {
            return .string(stringValue)
        } else if let boolValue = value as? Bool {
            return .boolean(boolValue)
        } else if let intValue = value as? Int {
            return .int(intValue)
        } else if let longValue = value as? Int64 {
            return .long(longValue)
        } else if let floatValue = value as? Float {
            return .float(floatValue)
        } else if let doubleValue = value as? Double {
            return .double(doubleValue)
        }
        return nil
    }
}

extension AttributeValue: Codable {
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .string(let value):
            try container.encode(value)
        case .boolean(let value):
            try container.encode(value)
        case .int(let value):
            try container.encode(value)
        case .long(let value):
            try container.encode(value)
        case .float(let value):
            try container.encode(value)
        case .double(let value):
            try container.encode(value)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let value = try? container.decode(Bool.self) {
            self = .boolean(value)
        } else if let value = try? container.decode(Int64.self) {
            self = .long(value)
        } else if let value = try? container.decode(Int.self) {
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(Float.self) {
            self = .float(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported AttributeValue type")
        }
    }
}
