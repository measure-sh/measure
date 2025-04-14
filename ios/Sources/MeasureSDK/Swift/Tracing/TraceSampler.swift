import Foundation

/// Protocol for determining if a span should be sampled.
protocol TraceSampler {
    /// Determines if a span should be sampled.
    ///
    /// - Returns: true if the span should be sampled, false otherwise
    func shouldSample() -> Bool
}

/// A simple trace sampler that uses a fixed sampling rate.
final class BaseTraceSampler: TraceSampler {
    private let configProvider: ConfigProvider
    private let randomizer: Randomizer

    init(configProvider: ConfigProvider, randomizer: Randomizer) {
        self.configProvider = configProvider
        self.randomizer = randomizer
    }

    func shouldSample() -> Bool {
        if configProvider.traceSamplingRate == 0.0 {
            return false
        }
        if configProvider.traceSamplingRate == 1.0 {
            return true
        }
        return randomizer.random() < configProvider.traceSamplingRate
    }
}
