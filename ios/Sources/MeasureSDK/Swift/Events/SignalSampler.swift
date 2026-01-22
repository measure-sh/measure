//
//  SignalSampler.swift
//  Measure
//
//  Created by Adwin Ross on 24/11/25.
//

import Foundation

protocol SignalSampler {
    func shouldTrackLaunchEvents() -> Bool
    func shouldTrackTrace() -> Bool
    func shouldSampleTrace(_ traceId: String) -> Bool
    func shouldTrackJourneyForSession(sessionId: String) -> Bool
}

final class BaseSignalSampler: SignalSampler {
    private let configProvider: ConfigProvider
    private let randomizer: Randomizer
    private var shouldSampleUserJourney: Bool?

    init(configProvider: ConfigProvider, randomizer: Randomizer) {
        self.configProvider = configProvider
        self.randomizer = randomizer
    }

    func shouldTrackLaunchEvents() -> Bool {
        return shouldTrack(configProvider.launchSamplingRate / 100)
    }

    func shouldTrackTrace() -> Bool {
        return shouldTrack(configProvider.traceSamplingRate / 100)
    }

    func shouldSampleTrace(_ traceId: String) -> Bool {
        if configProvider.enableFullCollectionMode {
            return true
        }

        let samplingRate = configProvider.traceSamplingRate

        if samplingRate == 0 {
            return false
        }
        if samplingRate == 100 {
            return true
        }

        let sampleRate = Double(samplingRate) / 100.0

        guard let idLo = longFromBase16String(traceId, offset: 16) else {
            return false
        }

        let threshold = Int64(Double(Int64.max) * sampleRate)
        return (idLo & Int64.max) < threshold
    }

    func shouldTrackJourneyForSession(sessionId: String) -> Bool {
        let samplingRate = configProvider.journeySamplingRate / 100.0

        if samplingRate == 0.0 {
            return false
        }
        if samplingRate == 1.0 {
            return true
        }

        return stableSamplingValue(sessionId: sessionId) < samplingRate
    }

    /// Generates a stable sampling value in [0, 1] from a session ID.
    ///
    /// Uses FNV-1a 64-bit hash for deterministic, uniformly distributed output.
    /// The same sessionId always produces the same value, ensuring consistent
    /// sampling decisions.
    ///
    /// Notes:
    /// - Constants are FNV-1a 64-bit (offset and prime)
    /// - `>> 1` on UInt64 clears the sign bit (equivalent to Kotlin's `ushr 1`)
    private func stableSamplingValue(sessionId: String) -> Float {
        // FNV-1a 64-bit constants
        var hash: UInt64 = 0xcbf29ce484222325
        let prime: UInt64 = 0x100000001b3

        for scalar in sessionId.unicodeScalars {
            hash ^= UInt64(scalar.value)
            hash &*= prime
        }

        // Clear sign bit and normalize to [0, 1]
        let shifted = hash >> 1
        return Float(shifted) / Float(UInt64.max >> 1)
    }

    private func shouldTrack(_ samplingRate: Float) -> Bool {
        if samplingRate == 0.0 {
            return false
        }
        if samplingRate == 1.0 {
            return true
        }
        return randomizer.random() < samplingRate
    }

    // TODO: get the official OTEL implementation
    private func longFromBase16String(_ chars: String, offset: Int) -> Int64? {
        guard chars.count >= offset + 16 else {
            return nil
        }

        let hex = chars.dropFirst(offset).prefix(16)

        var result: Int64 = 0
        var index = hex.startIndex

        for shift in stride(from: 56, through: 0, by: -8) {
            guard index < hex.endIndex else { return nil }

            let nextIndex = hex.index(index, offsetBy: 2)
            let byteString = hex[index..<nextIndex]

            guard let byte = UInt8(byteString, radix: 16) else {
                return nil
            }

            result |= Int64(byte) << shift
            index = nextIndex
        }

        return result
    }
}
