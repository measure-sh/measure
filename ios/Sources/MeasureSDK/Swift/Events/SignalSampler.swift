//
//  SignalSampler.swift
//  Measure
//
//  Created by Adwin Ross on 24/11/25.
//

import Foundation

protocol SignalSampler {
    func shouldTrackLaunchEvents() -> Bool
    func shouldMarkSessionForExport() -> Bool
    func shouldTrackTrace() -> Bool
    func shouldSampleTrace(_ traceId: String) -> Bool
    func shouldTrackJourneyEvents() -> Bool
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

    // TODO: use dynamic config property here
    func shouldMarkSessionForExport() -> Bool {
        return shouldTrack(1)
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

    func shouldTrackJourneyEvents() -> Bool {
        if let shouldSampleUserJourney {
            return shouldSampleUserJourney
        }
        shouldSampleUserJourney = shouldTrack(configProvider.journeySamplingRate / 100)
        return shouldSampleUserJourney!
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
