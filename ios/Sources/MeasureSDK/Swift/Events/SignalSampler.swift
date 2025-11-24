//
//  SignalSampler.swift
//  Measure
//
//  Created by Adwin Ross on 24/11/25.
//

import Foundation

protocol SignalSampler {
    func shouldTrackLaunchEvents(type: EventType) -> Bool
    func shouldMarkSessionForExport() -> Bool
    func shouldTrackTrace() -> Bool
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

    func shouldTrackLaunchEvents(type: EventType) -> Bool {
        switch type {
        case .coldLaunch:
            return shouldTrack(configProvider.coldLaunchSamplingRate)
        case .warmLaunch:
            return shouldTrack(configProvider.warmLaunchSamplingRate)
        case .hotLaunch:
            return shouldTrack(configProvider.hotLaunchSamplingRate)
        default :
            return true
        }
    }

    func shouldMarkSessionForExport() -> Bool {
        return shouldTrack(configProvider.samplingRateForErrorFreeSessions)
    }

    func shouldTrackTrace() -> Bool {
        return shouldTrack(configProvider.traceSamplingRate)
    }

    func shouldTrackJourneyEvents() -> Bool {
        if let shouldSampleUserJourney {
            return shouldSampleUserJourney
        }
        shouldSampleUserJourney = shouldTrack(configProvider.userJourneysSamplingRate)
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
}
