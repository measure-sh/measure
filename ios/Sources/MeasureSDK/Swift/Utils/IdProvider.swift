//
//  IdProvider.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/08/24.
//

import Foundation

/// Unique indentity provider protocol
protocol IdProvider {
    func createId() -> String
}

/// UUID provider
final class UUIDProvider: IdProvider {
    func createId() -> String {
        return UUID().uuidString.lowercased()
    }
}
