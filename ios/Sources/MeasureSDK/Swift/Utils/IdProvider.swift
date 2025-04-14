//
//  IdProvider.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/08/24.
//

import Foundation

/// Unique indentity provider protocol
protocol IdProvider {
    /// Creates a unique identifier.
    func uuid() -> String

    /// Creates a unique span identifier.
    /// - Returns: A 16-character hexadecimal string representing the span ID.
    func spanId() -> String

    /// Creates a unique trace identifier.
    /// - Returns: A 32-character hexadecimal string representing the trace ID.
    func traceId() -> String
}

/// UUID provider
final class UUIDProvider: IdProvider {
    func uuid() -> String {
        return UUID().uuidString.lowercased()
    }

    func spanId() -> String {
        // Generate a random Int64 value (equivalent to Java's Long)
        var id: Int64
        repeat {
            // Generate a random 64-bit integer
            id = Int64.random(in: Int64.min...Int64.max)
        } while id == 0

        // Convert to base16 string using OtelEncodingUtils
        var chars = [Character](repeating: "0", count: 16)
        OtelEncodingUtils.longToBase16String(id, dest: &chars, destOffset: 0)
        return String(chars)
    }

    func traceId() -> String {
        // Generate two random Int64 values for the high and low parts
        let idHi = Int64.random(in: Int64.min...Int64.max)
        var idLo: Int64
        repeat {
            idLo = Int64.random(in: Int64.min...Int64.max)
        } while idLo == 0

        // Convert to base16 string using OtelEncodingUtils
        var chars = [Character](repeating: "0", count: 32)
        OtelEncodingUtils.longToBase16String(idHi, dest: &chars, destOffset: 0)
        OtelEncodingUtils.longToBase16String(idLo, dest: &chars, destOffset: 16)
        return String(chars)
    }
}
