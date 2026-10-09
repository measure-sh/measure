//
//  PingAppHangDetectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/26.
//

@testable import Measure
import XCTest

final class PingAppHangDetectorTests: XCTestCase {
    private var logger: MockLogger!
    private var configProvider: MockConfigProvider!
    private var stackCapture: MockAppHangStackCapture!
    private var callbacks: MockAppHangCallbacks!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        configProvider = MockConfigProvider()
        stackCapture = MockAppHangStackCapture()
        callbacks = MockAppHangCallbacks()
    }

    override func tearDown() {
        logger = nil
        configProvider = nil
        stackCapture = nil
        callbacks = nil
        super.tearDown()
    }

    /// The real environment always carries the XCTest key, so tests pass an explicit one to reach
    /// the guards underneath it.
    private func makeDetector(environment: [String: String] = [:]) -> PingAppHangDetector {
        let detector = PingAppHangDetector(logger: logger,
                                           configProvider: configProvider,
                                           stackCapture: stackCapture,
                                           timeProvider: MockTimeProvider(),
                                           environment: environment)
        detector.callbacks = callbacks
        return detector
    }

    private func assertLogged(_ fragment: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(logger.logs.contains { $0.contains(fragment) },
                      "Expected a log containing \"\(fragment)\", got: \(logger.logs)",
                      file: file,
                      line: line)
    }

    // MARK: - Guards

    func testEnableStartsDetection_whenNoGuardApplies() {
        let detector = makeDetector()

        detector.enable()
        defer { detector.disable() }

        assertLogged("detection enabled")
    }

    /// An attached debugger is deliberately not a reason to skip, matching Datadog. Stepping in
    /// Xcode will therefore be reported as a hang; long pauses are filtered by the oversleep guard
    /// and the duration ceiling instead.
    func testEnableStartsDetection_regardlessOfDebugger() {
        let detector = makeDetector()

        detector.enable()
        defer { detector.disable() }

        assertLogged("detection enabled")
        XCTAssertFalse(logger.logs.contains { $0.contains("debugger") },
                       "A debugger must not gate detection.")
    }

    func testEnableSkips_underXCTest() {
        let detector = makeDetector(environment: [AppHangConstants.xctestEnvKey: "/path/to/config.plist"])

        detector.enable()

        assertLogged("running under XCTest")
    }

    /// Detection must start during launch, before the app has foregrounded, or launch hangs go
    /// unreported. Backgrounding is handled by `disable()` on the transition instead.
    func testEnableStartsDetection_beforeTheAppHasForegrounded() {
        let detector = makeDetector()

        detector.enable()
        defer { detector.disable() }

        assertLogged("detection enabled")
        XCTAssertFalse(logger.logs.contains { $0.contains("foreground") },
                       "Application state must not gate detection.")
    }

    // MARK: - Lifecycle

    func testDisableIsSafe_whenNeverEnabled() {
        let detector = makeDetector()

        detector.disable()

        XCTAssertFalse(logger.logs.contains { $0.contains("detection disabled.") },
                       "Disabling a detector that never started should be a no-op.")
    }

    func testEnableIsIdempotent() {
        let detector = makeDetector()

        detector.enable()
        detector.enable()
        defer { detector.disable() }

        let enabledLogs = logger.logs.filter { $0.contains("detection enabled") }
        XCTAssertEqual(enabledLogs.count, 1, "Enabling twice should start only one detector thread.")
    }

    func testDetectorCanBeReEnabledAfterDisable() {
        let detector = makeDetector()

        detector.enable()
        detector.disable()
        detector.enable()
        defer { detector.disable() }

        let enabledLogs = logger.logs.filter { $0.contains("detection enabled") }
        XCTAssertEqual(enabledLogs.count, 2, "A foreground transition should restart detection.")
    }

    // MARK: - Detection

    /// The detector reads the threshold every iteration, so a remote config change takes effect
    /// without restarting it.
    func testHangIsDetectedAndStackCaptured() throws {
        configProvider.appHangThresholdMillis = 1_000
        let detector = makeDetector()

        detector.enable()
        defer { detector.disable() }

        // Longer than the threshold plus one heartbeat interval, so at least one tick fires
        // before the thread recovers.
        Thread.sleep(forTimeInterval: 2.4)

        let hangDetected = expectation(description: "hang reported")
        DispatchQueue.main.async { hangDetected.fulfill() }
        wait(for: [hangDetected], timeout: 5)

        // The detector reports from its own thread, so give it a moment to finish the iteration.
        let settled = expectation(description: "detector settled")
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) { settled.fulfill() }
        wait(for: [settled], timeout: 5)

        assertLogged("hang started")
        assertLogged("hang ended")
        XCTAssertEqual(stackCapture.captureCount, 1,
                       "The stack is walked once per hang — heartbeats only update the duration.")
        XCTAssertGreaterThan(callbacks.heartbeatCount, 0, "A hang longer than the heartbeat interval should tick.")
        XCTAssertEqual(callbacks.startedCount, 1)
        XCTAssertEqual(callbacks.endedCount, 1)
        XCTAssertGreaterThan(callbacks.lastDurationMs ?? 0, 2_000, "Reported duration should be the real one, not the threshold.")
        XCTAssertGreaterThan(try XCTUnwrap(callbacks.lastHeartbeatMs), 1_000, "The heartbeat reports elapsed time, not the threshold.")
    }

    func testNoHangIsReported_whenMainThreadIsResponsive() {
        configProvider.appHangThresholdMillis = 1_000
        let detector = makeDetector()

        detector.enable()
        defer { detector.disable() }

        let settled = expectation(description: "detector ran a few cycles")
        DispatchQueue.global().asyncAfter(deadline: .now() + 1.5) { settled.fulfill() }
        wait(for: [settled], timeout: 5)

        XCTAssertFalse(logger.logs.contains { $0.contains("hang started") },
                       "A responsive main thread must not produce a hang.")
        XCTAssertEqual(stackCapture.captureCount, 0)
        XCTAssertEqual(callbacks.startedCount, 0)
    }
    // MARK: - Idle interval

    /// The probe rate is `1 / idleInterval`, so this is what governs the detector's idle cost.
    /// Deriving it from the threshold alone makes a more sensitive threshold proportionally more
    /// expensive, which is what the floor exists to stop.
    func testIdleIntervalIsDerivedFromThreshold_aboveTheFloor() {
        XCTAssertEqual(AppHangConstants.idleIntervalMs(forThresholdMs: 2_000), 50, accuracy: 0.001)
        XCTAssertEqual(AppHangConstants.idleIntervalMs(forThresholdMs: 10_000), 250, accuracy: 0.001)
    }

    /// At the 2s default the derived value already equals the floor, so the floor changes nothing
    /// about what ships and only bites below it.
    func testIdleIntervalFloorDoesNotAffectTheDefault() {
        XCTAssertEqual(AppHangConstants.idleIntervalMs(forThresholdMs: 2_000),
                       AppHangConstants.minIdleIntervalMs,
                       accuracy: 0.001)
    }

    func testIdleIntervalIsClamped_belowTheFloor() {
        // 1000 * 0.025 = 25ms, which would double the poll rate.
        XCTAssertEqual(AppHangConstants.idleIntervalMs(forThresholdMs: 1_000), 50, accuracy: 0.001)
        XCTAssertEqual(AppHangConstants.idleIntervalMs(forThresholdMs: 250), 50, accuracy: 0.001)
    }
}
