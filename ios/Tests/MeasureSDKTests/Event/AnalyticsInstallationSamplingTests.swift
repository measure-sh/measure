import XCTest
@testable import Measure

final class AnalyticsInstallationSamplingTests: XCTestCase {
    // FNV-1a sampling values are approximately 0.485234 and 0.553295.
    private let includedInstallation = "00000000-0000-0000-0000-000000000001"
    private let excludedInstallation = "123e4567-e89b-12d3-a456-426614174000"
    private var config: MockConfigProvider!
    private var sampler: BaseSignalSampler!
    private var sessionManager: MockSessionManager!
    private var signalStore: MockSignalStore!
    private var processor: BaseSignalProcessor!

    override func setUp() {
        super.setUp()
        config = MockConfigProvider()
        sampler = BaseSignalSampler(configProvider: config, randomizer: MockRandomizer())
        sessionManager = MockSessionManager(sessionId: "session-1")
        signalStore = MockSignalStore()
        processor = BaseSignalProcessor(
            logger: MockLogger(),
            idProvider: MockIdProvider(),
            sessionManager: sessionManager,
            attributeProcessors: [],
            configProvider: config,
            timeProvider: MockTimeProvider(),
            crashDataPersistence: MockCrashDataPersistence(attribute: nil, sessionId: "", isForeground: true),
            signalStore: signalStore,
            measureDispatchQueue: MockMeasureDispatchQueue(),
            signalSampler: sampler,
            exporter: MockExporter()
        )
    }

    func testPointZeroOnePercentRateSelectsInstallationsBelowThreshold() {
        config.analyticsSamplingRate = 0.01
        // FNV-1a sampling value is approximately 0.000037.
        let sampledInstallation = "00002f2d-0000-0000-0000-000000000001"
        trackCustomEvent(installationId: sampledInstallation)
        trackCustomEvent(installationId: includedInstallation)
        XCTAssertEqual(signalStore.storedEvents.map(\.needsReporting), [true, false])
    }

    func testFractionalRateSelectsWholeInstallationsAcrossSessions() {
        config.analyticsSamplingRate = 50
        for session in ["session-1", "session-2", "session-3"] {
            sessionManager.sessionId = session
            trackCustomEvent(installationId: includedInstallation)
            trackCustomEvent(installationId: excludedInstallation)
        }
        XCTAssertEqual(signalStore.storedEvents.map(\.needsReporting),
                       [true, false, true, false, true, false])
    }

    func testFullCollectionModeOverridesZeroRate() {
        config.analyticsSamplingRate = 0
        config.enableFullCollectionMode = true
        trackCustomEvent(installationId: excludedInstallation)
        XCTAssertEqual(signalStore.storedEvents.first?.needsReporting, true)
    }

    func testAnalyticsSamplingDoesNotChangeOtherEvents() {
        config.analyticsSamplingRate = 100
        processor.track(data: "cpu", timestamp: 1000, type: .cpuUsage,
                        attributes: Attributes(installationId: includedInstallation), sessionId: nil, attachments: nil,
                        userDefinedAttributes: nil, threadName: nil, needsReporting: false)
        XCTAssertEqual(signalStore.storedEvents.first?.needsReporting, false)
    }

    func testEventTypesFromConfigAreSampledByInstallation() {
        config.analyticsSamplingRate = 50
        config.analyticsEventTypes = [EventType.cpuUsage.rawValue]
        processor.track(data: "cpu", timestamp: 1000, type: .cpuUsage,
                        attributes: Attributes(installationId: excludedInstallation), sessionId: nil, attachments: nil,
                        userDefinedAttributes: nil, threadName: nil, needsReporting: true)
        XCTAssertEqual(signalStore.storedEvents.first?.needsReporting, false)
    }

    private func trackCustomEvent(installationId: String) {
        processor.trackUserTriggered(data: CustomEventData(name: "checkout_completed"),
                                     timestamp: 1000, type: .custom,
                                     attributes: Attributes(installationId: installationId), sessionId: nil, attachments: nil,
                                     userDefinedAttributes: nil, threadName: nil, needsReporting: false)
    }
}
