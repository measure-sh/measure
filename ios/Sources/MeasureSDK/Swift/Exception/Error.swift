//
//  Error.swift
//  Measure
//
//  Created by Adwin Ross on 17/06/25.
//

import Foundation

struct MsrError: Codable {
    /// Numeric code that describes the error
    let numcode: Int64?

    /// String code that describes the error
    let code: String?

    /// Object containing arbitrary fields for error's metdata
    let meta: [String: CodableValue]?
}

/// CodableValue is a simple wrapper for heterogenous dictionary values
enum CodableValue: Codable {
    case string(String)
    case int(Int64)
    case bool(Bool)
    case double(Double)
    case array([CodableValue])
    case dictionary([String: CodableValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let str = try? container.decode(String.self) {
            self = .string(str)
        } else if let int = try? container.decode(Int64.self) {
            self = .int(int)
        } else if let dbl = try? container.decode(Double.self) {
            self = .double(dbl)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let arr = try? container.decode([CodableValue].self) {
            self = .array(arr)
        } else if let dict = try? container.decode([String: CodableValue].self) {
            self = .dictionary(dict)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported type")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let str): try container.encode(str)
        case .int(let int): try container.encode(int)
        case .double(let dbl): try container.encode(dbl)
        case .bool(let bool): try container.encode(bool)
        case .array(let arr): try container.encode(arr)
        case .dictionary(let dict): try container.encode(dict)
        case .null: try container.encodeNil()
        }
    }
}
