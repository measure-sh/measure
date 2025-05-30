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
        return SpanId.random().hexString
    }

    func traceId() -> String {
        return TraceId.random().hexString // afad59f818999695
    }
}
