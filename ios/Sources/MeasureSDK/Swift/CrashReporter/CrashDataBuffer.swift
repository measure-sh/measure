//
//  CrashDataBuffer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 08/09/26.
//

import Foundation

struct CrashDataBuffer {
    private static let capacity = 256

    private var cachedValue: String?
    private var storage = [CChar](repeating: 0, count: CrashDataBuffer.capacity)

    mutating func update(_ newValue: String?) {
        guard newValue != cachedValue else { return }
        cachedValue = newValue
        let source = newValue ?? ""
        storage.withUnsafeMutableBufferPointer { buffer in
            guard let base = buffer.baseAddress else { return }
            _ = source.withCString { strlcpy(base, $0, CrashDataBuffer.capacity) }
        }
    }

    func withCString(_ body: (UnsafePointer<CChar>) -> Void) {
        storage.withUnsafeBufferPointer { buffer in
            if let base = buffer.baseAddress {
                body(base)
            }
        }
    }
}
