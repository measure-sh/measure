//
//  JSONWriter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 19/08/26.
//

import Foundation

struct JSONWriter {
    private static let quote = UInt8(ascii: "\"")
    private static let colon = UInt8(ascii: ":")
    private static let comma = UInt8(ascii: ",")
    private static let openBrace = UInt8(ascii: "{")
    private static let closeBrace = UInt8(ascii: "}")
    private static let openBracket = UInt8(ascii: "[")
    private static let closeBracket = UInt8(ascii: "]")
    private static let emptyString = Data("\"\"".utf8)

    private var buffer: Data
    private var needsSeparator = false

    init(capacity: Int = 512) {
        self.buffer = Data(capacity: capacity)
        self.buffer.append(Self.openBrace)
    }

    mutating func finalize() -> Data {
        buffer.append(Self.closeBrace)
        return buffer
    }

    mutating func append(key: String, string value: String) {
        appendKey(key)
        buffer.append(Self.escaped(value))
    }

    mutating func append(key: String, optionalString value: String?) {
        guard let value else { return }
        append(key: key, string: value)
    }

    mutating func append(key: String, unescapedIdentifier value: String) {
        appendKey(key)
        buffer.append(Self.quote)
        buffer.append(contentsOf: value.utf8)
        buffer.append(Self.quote)
    }

    mutating func append(key: String, optionalUnescapedIdentifier value: String?) {
        guard let value else { return }
        append(key: key, unescapedIdentifier: value)
    }

    mutating func append(key: String, int value: Int64) {
        appendKey(key)
        buffer.append(contentsOf: String(value).utf8)
    }

    mutating func append(key: String, bool value: Bool) {
        appendKey(key)
        buffer.append(contentsOf: (value ? "true" : "false").utf8)
    }

    mutating func append(key: String, rawJson value: Data?, fallback: Data? = nil) {
        guard let json = (value?.isEmpty == false) ? value : fallback, !json.isEmpty else { return }
        appendKey(key)
        buffer.append(json)
    }

    mutating func append(key: String, rawJsonObject value: String?) {
        guard let value else { return }

        guard let data = value.data(using: .utf8),
              (try? JSONSerialization.jsonObject(with: data, options: [])) is [String: Any] else {
            append(key: key, string: value)
            return
        }

        appendKey(key)
        buffer.append(data)
    }

    private mutating func appendKey(_ key: String) {
        if needsSeparator {
            buffer.append(Self.comma)
        }
        needsSeparator = true
        buffer.append(Self.quote)
        buffer.append(contentsOf: key.utf8)
        buffer.append(Self.quote)
        buffer.append(Self.colon)
    }

    static func appendArray(of items: [Data], to data: inout Data) {
        data.append(openBracket)
        for (index, item) in items.enumerated() {
            if index > 0 {
                data.append(comma)
            }
            data.append(item)
        }
        data.append(closeBracket)
    }

    static func array(of items: [Data]) -> Data {
        var data = Data(capacity: items.reduce(2) { $0 + $1.count + 1 })
        appendArray(of: items, to: &data)
        return data
    }

    static func escaped(_ string: String) -> Data {
        guard let wrapped = try? JSONSerialization.data(withJSONObject: [string], options: []) else {
            return emptyString
        }
        return wrapped.dropFirst().dropLast()
    }
}
