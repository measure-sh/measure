import XCTest
@testable import Measure

final class MemorySessionSamplingTests: XCTestCase {
    private let includedSession = "00000000-0000-0000-0000-000000000001"
    private let excludedSession = "123e4567-e89b-12d3-a456-426614174000"
    private var config: MockConfigProvider!
    private var sampler: BaseSignalSampler!
    private var sessionManager: MockSessionManager!
    private var signalStore: MockSignalStore!
    private var processor: BaseSignalProcessor!

    override func setUp() {
        super.setUp()
        config = MockConfigProvider()
        sampler = BaseSignalSampler(configProvider: config, randomizer: MockRandomizer())
        sessionManager = MockSessionManager(sessionId: includedSession)
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

    func testDefaultMemorySamplingUsesPointZeroOnePercentThreshold() {
        XCTAssertEqual(config.memoryUsageSessionSamplingRate, 0.01)
        // FNV-1a sampling values are approximately 0.000037 and 0.4852.
        let sampledSession = "00002f2d-0000-0000-0000-000000000001"
        trackMemory(sessionId: sampledSession)
        trackMemory(sessionId: includedSession)
        XCTAssertEqual(signalStore.storedEvents.map(\.needsReporting), [true, false])
    }

    func testZeroRateRetainsReadingsForReplayWithoutReporting() {
        config.memoryUsageSessionSamplingRate = 0
        trackMemory()
        XCTAssertEqual(signalStore.storedEvents.count, 1)
        XCTAssertEqual(signalStore.storedEvents.first?.needsReporting, false)
        XCTAssertEqual(sessionManager.onEventTrackedCallCount, 1)
    }

    func testFractionalRateSelectsWholeSessionsUsingAndroidHash() {
        config.memoryUsageSessionSamplingRate = 50
        // FNV-1a sampling values are approximately 0.485234 and 0.553295.
        for _ in 0..<5 {
            trackMemory(sessionId: includedSession)
            trackMemory(sessionId: excludedSession)
        }
        XCTAssertEqual(signalStore.storedEvents.map(\.needsReporting),
                       [true, false, true, false, true, false, true, false, true, false])
    }

    func testExplicitEventSessionControlsSampling() {
        config.memoryUsageSessionSamplingRate = 50
        sessionManager.sessionId = excludedSession
        trackMemory(sessionId: includedSession)
        XCTAssertEqual(signalStore.storedEvents.first?.sessionId, includedSession)
        XCTAssertEqual(signalStore.storedEvents.first?.needsReporting, true)
    }

    func testSessionRolloverReevaluatesSampling() {
        config.memoryUsageSessionSamplingRate = 50
        trackMemory()
        sessionManager.sessionId = excludedSession
        trackMemory()
        XCTAssertEqual(signalStore.storedEvents.map(\.needsReporting), [true, false])
    }

    func testConfigUpdateChangesSampling() {
        config.memoryUsageSessionSamplingRate = 0
        trackMemory()
        config.memoryUsageSessionSamplingRate = 100
        trackMemory()
        XCTAssertEqual(signalStore.storedEvents.map(\.needsReporting), [false, true])
    }

    func testFullCollectionModeOverridesZeroSamplingRate() {
        config.memoryUsageSessionSamplingRate = 0
        config.enableFullCollectionMode = true
        XCTAssertTrue(sampler.shouldTrackMemoryUsageForSession(sessionId: includedSession))
        trackMemory()
        XCTAssertEqual(signalStore.storedEvents.first?.needsReporting, true)
    }

    func testInvalidSamplingRatesDoNotSelectSessions() {
        for rate: Float in [-1, .nan, .infinity, -.infinity] {
            config.memoryUsageSessionSamplingRate = rate
            XCTAssertFalse(sampler.shouldTrackMemoryUsageForSession(sessionId: includedSession))
        }
    }

    func testMemorySamplingDoesNotChangeOtherEvents() {
        config.memoryUsageSessionSamplingRate = 100
        processor.track(data: "cpu", timestamp: 1000, type: .cpuUsage,
                        attributes: nil, sessionId: nil, attachments: nil,
                        userDefinedAttributes: nil, threadName: nil, needsReporting: false)
        XCTAssertEqual(signalStore.storedEvents.first?.needsReporting, false)
    }

    func testDynamicConfigDecodesAndPersistsSamplingRate() throws {
        let data = Data(#"{"memory_usage_session_sampling_rate": 37.5}"#.utf8)
        let decoded = try JSONDecoder().decode(BaseDynamicConfig.self, from: data)
        let provider = BaseConfigProvider(defaultConfig: Config())
        provider.setDynamicConfig(decoded)
        XCTAssertEqual(provider.memoryUsageSessionSamplingRate, 37.5)

        let encoded = try JSONEncoder().encode(decoded)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        XCTAssertEqual(json["memory_usage_session_sampling_rate"] as? Double, 37.5)
        let restored = try JSONDecoder().decode(BaseDynamicConfig.self, from: encoded)
        XCTAssertEqual(restored.memoryUsageSessionSamplingRate, 37.5)
    }

    func testLegacyConfigUsesDefaultMemorySamplingRate() throws {
        for json in ["{}", #"{"memory_usage_session_sampling_rate": null}"#] {
            let decoded = try JSONDecoder().decode(BaseDynamicConfig.self, from: Data(json.utf8))
            XCTAssertEqual(decoded.memoryUsageSessionSamplingRate, 0.01)
        }
    }

    private func trackMemory(sessionId: String? = nil) {
        processor.track(data: MemoryUsageData(maxMemory: 4096, usedMemory: 1024, interval: 5000, availableMemory: 512),
                        timestamp: 1000, type: .memoryUsageAbsolute,
                        attributes: nil, sessionId: sessionId, attachments: nil,
                        userDefinedAttributes: nil, threadName: nil, needsReporting: false)
    }
}
