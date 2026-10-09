//
//  AppHangCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/26.
//

@testable import Measure
import XCTest

/// Drives the collector through the detector callbacks directly, so the two-phase write can be
/// exercised without waiting on real timing.
final class AppHangCollectorTests: XCTestCase {
    private var logger: MockLogger!
    private var detector: MockAppHangDetector!
    private var signalProcessor: MockSignalProcessor!
    private var signalSampler: MockSignalSampler!
    private var eventStore: MockEventStore!
    private var sessionStore: MockSessionStore!
    private var configProvider: MockConfigProvider!
    private var crashDataPersistence: MockCrashDataPersistence!
    private var sysCtl: MockSysCtl!
    private var exporter: MockExporter!
    private var collector: BaseAppHangCollector!

    private let sessionId = "session-1"

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        detector = MockAppHangDetector()
        signalProcessor = MockSignalProcessor()
        signalSampler = MockSignalSampler()
        eventStore = MockEventStore()
        sessionStore = MockSessionStore()
        configProvider = MockConfigProvider()
        crashDataPersistence = MockCrashDataPersistence(attribute: Attributes(), sessionId: sessionId, isForeground: true)
        sysCtl = MockSysCtl()
        sysCtl.osBuildNumber = "22D72"
        exporter = MockExporter()

        collector = BaseAppHangCollector(logger: logger,
                                         detector: detector,
                                         signalProcessor: signalProcessor,
                                         signalSampler: signalSampler,
                                         eventStore: eventStore,
                                         sessionStore: sessionStore,
                                         configProvider: configProvider,
                                         crashDataPersistence: crashDataPersistence,
                                         sysCtl: sysCtl,
                                         exporter: exporter)
    }

    override func tearDown() {
        collector = nil
        logger = nil
        detector = nil
        signalProcessor = nil
        signalSampler = nil
        eventStore = nil
        sessionStore = nil
        configProvider = nil
        crashDataPersistence = nil
        sysCtl = nil
        exporter = nil
        super.tearDown()
    }

    private func makeStack() -> AppHangStack {
        MockAppHangStackCapture().stack!
    }

    private func startHang(thresholdMs: Number = 2_000, timestamp: Number = 1_000_000) {
        collector.onAppHangStarted(stack: makeStack(), thresholdMs: thresholdMs, timestamp: timestamp)
    }

    private var trackedAppHang: AppHang? {
        signalProcessor.trackedAppHang
    }

    /// The payload as currently stored on the row, which the heartbeat rewrites in place.
    private func storedPayload(_ eventId: String) -> AppHang? {
        guard let data = eventStore.getEvents(eventIds: [eventId])?.first?.appHang else { return nil }
        return try? JSONDecoder().decode(AppHang.self, from: data)
    }

    /// Writes an unresolved hang as a previous launch would have left it: a pending row in an
    /// earlier session, optionally with a heartbeat record beside it.
    @discardableResult
    private func seedPreviousLaunchRecord(eventId: String = "hang-1",
                                          storedDurationMs: Number = 9_000,
                                          sessionId: String = "previous-session",
                                          pendingResolution: Bool = true,
                                          needsReporting: Bool = true,
                                          timestampInMillis: Number = 1_000_000) -> String {
        let detail = AppHangDetail(threadName: "main", threadSequence: 0, osBuildNumber: "22D72", frames: [])
        let appHang = AppHang(exceptions: [detail],
                              duration: storedDurationMs,
                              state: .killed,
                              framework: Framework.apple,
                              foreground: true,
                              binaryImages: nil)

        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: eventId,
                                                                       sessionId: sessionId,
                                                                       type: "app_hang",
                                                                       timestampInMillis: timestampInMillis,
                                                                       appHang: try? JSONEncoder().encode(appHang),
                                                                       needsReporting: needsReporting,
                                                                       pendingResolution: pendingResolution))

        return eventId
    }

    private func resolvedPayload(_ eventId: String) -> AppHang? {
        guard let data = eventStore.resolvedAppHangs[eventId] else { return nil }
        return try? JSONDecoder().decode(AppHang.self, from: data)
    }

    // MARK: - Wiring

    func testCollectorRegistersItselfWithTheDetector() {
        XCTAssertTrue(detector.callbacks === collector)
    }

    func testEnableAndDisableDriveTheDetector() {
        collector.enable()
        XCTAssertEqual(detector.enableCallCount, 1)

        collector.disable()
        XCTAssertEqual(detector.disableCallCount, 1)
    }

    func testEnableIsIdempotent() {
        collector.enable()
        collector.enable()

        XCTAssertEqual(detector.enableCallCount, 1)
    }

    // MARK: - Sampling

    /// Sampling decides reportability, not whether the hang is recorded — matching how
    /// `error_*_sampling_rate` behaves, so a sampled out hang still appears in session timelines.
    func testSampledOutHangIsStillStored() throws {
        signalSampler.shouldSampleAppHangReturnValue = false

        startHang()

        XCTAssertNotNil(trackedAppHang, "A sampled out hang must still be captured and stored.")
        XCTAssertEqual(signalProcessor.trackedAppHangNeedsReporting, false)
    }

    func testSampledInHangIsMarkedForReporting() {
        signalSampler.shouldSampleAppHangReturnValue = true

        startHang()

        XCTAssertEqual(signalProcessor.trackedAppHangNeedsReporting, true)
    }

    /// A hang that is not being reported must not drag a replay window into an export with it.
    func testSampledOutHangDoesNotMarkTheTimeline() {
        signalSampler.shouldSampleAppHangReturnValue = false
        configProvider.appHangReplayEnabled = true
        startHang()

        collector.onAppHangEnded(durationMs: 3_184)

        XCTAssertNil(eventStore.lastMarkTimelineDurationSeconds)
    }

    // MARK: - Export

    /// The SDK exports on background, foreground and startup, with nothing in between, so a hang
    /// recorded mid-session would sit on disk until the user left the app.
    func testRecoveredHangExportsImmediately() {
        signalSampler.shouldSampleAppHangReturnValue = true
        startHang()

        XCTAssertEqual(exporter.exportCallCount, 0, "Nothing is exportable until the hang resolves.")

        collector.onAppHangEnded(durationMs: 3_184)

        XCTAssertEqual(exporter.exportCallCount, 1)
    }

    /// A sampled out hang stays on disk for the session timeline and has nothing to send.
    func testSampledOutHangDoesNotExport() {
        signalSampler.shouldSampleAppHangReturnValue = false
        startHang()

        collector.onAppHangEnded(durationMs: 3_184)

        XCTAssertEqual(exporter.exportCallCount, 0)
    }

    /// The row is still held out of every export query by `pendingResolution` while the main
    /// thread is blocked, so a heartbeat has nothing new to send.
    func testHeartbeatDoesNotExport() {
        signalSampler.shouldSampleAppHangReturnValue = true
        startHang()

        collector.onAppHangHeartbeat(elapsedMs: 4_000)
        collector.onAppHangHeartbeat(elapsedMs: 5_000)

        XCTAssertEqual(exporter.exportCallCount, 0)
    }

    func testDiscardedHangDoesNotExport() {
        signalSampler.shouldSampleAppHangReturnValue = true
        startHang()

        collector.onAppHangDiscarded(reason: "test")

        XCTAssertEqual(exporter.exportCallCount, 0)
    }

    /// Each recovery asks once. The exporter itself collapses overlapping requests.
    func testEachRecoveredHangExportsOnce() {
        signalSampler.shouldSampleAppHangReturnValue = true

        startHang()
        collector.onAppHangEnded(durationMs: 3_184)
        startHang()
        collector.onAppHangEnded(durationMs: 2_500)

        XCTAssertEqual(exporter.exportCallCount, 2)
    }

    // MARK: - Hang start

    /// The pessimistic default: if the process dies here, `killed` is what was true.
    func testHangIsRecordedAsKilledWithTheThresholdAsDuration() {
        startHang(thresholdMs: 2_000, timestamp: 1_000_000)

        let appHang = try? XCTUnwrap(trackedAppHang)
        XCTAssertEqual(appHang?.state, .killed)
        XCTAssertEqual(appHang?.duration, 2_000)
        XCTAssertEqual(appHang?.framework, Framework.apple)
        XCTAssertEqual(appHang?.foreground, true)
        XCTAssertEqual(signalProcessor.trackedAppHangTimestamp, 1_000_000)
        XCTAssertEqual(signalProcessor.trackedAppHangSessionId, sessionId)
    }

    func testHangCarriesTheCapturedStackAndImages() throws {
        startHang()

        let appHang = try XCTUnwrap(trackedAppHang)
        XCTAssertEqual(appHang.exceptions.count, 1, "Only the main thread is captured.")
        XCTAssertEqual(appHang.exceptions[0].threadName, "main")
        XCTAssertEqual(appHang.exceptions[0].threadSequence, 0)
        XCTAssertEqual(appHang.exceptions[0].osBuildNumber, "22D72")
        XCTAssertEqual(appHang.exceptions[0].frames?.count, 1)
        XCTAssertEqual(appHang.binaryImages?.count, 1)
    }

    /// Without frames a hang says only that the app froze, with nothing to attribute it to and
    /// nothing to fingerprint, so it is dropped rather than stored unactionable.
    func testHangIsDiscardedWhenTheStackCouldNotBeCaptured() {
        collector.onAppHangStarted(stack: nil, thresholdMs: 2_000, timestamp: 1_000_000)

        XCTAssertNil(trackedAppHang, "A hang with no stack must not be recorded.")
    }

    func testHangIsDiscardedWhenTheStackHasNoFrames() {
        let empty = AppHangStack(frames: [], binaryImages: [])

        collector.onAppHangStarted(stack: empty, thresholdMs: 2_000, timestamp: 1_000_000)

        XCTAssertNil(trackedAppHang, "A hang with an empty stack must not be recorded.")
    }

    /// A discarded hang leaves nothing pending, so the resolution that follows is a no-op
    /// rather than acting on the previous hang.
    func testADiscardedHangLeavesNothingPending() {
        collector.onAppHangStarted(stack: nil, thresholdMs: 2_000, timestamp: 1_000_000)

        collector.onAppHangEnded(durationMs: 3_184)

        XCTAssertNil(trackedAppHang)
        XCTAssertEqual(exporter.exportCallCount, 0)
    }

    /// The heartbeat rewrites the stored payload in place, so a hang the process does not
    /// survive carries a real duration rather than only the threshold.
    func testHeartbeatRewritesTheStoredDuration() throws {
        startHang(thresholdMs: 2_000)
        let eventId = try XCTUnwrap(signalProcessor.trackedAppHangEventId)
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: eventId,
                                                                       type: "app_hang",
                                                                       appHang: try JSONEncoder().encode(XCTUnwrap(trackedAppHang)),
                                                                       pendingResolution: true))

        collector.onAppHangHeartbeat(elapsedMs: 3_000)
        collector.onAppHangHeartbeat(elapsedMs: 4_000)

        let payload = try XCTUnwrap(storedPayload(eventId))
        XCTAssertEqual(payload.duration, 4_000)
        XCTAssertEqual(payload.state, .killed, "It is still unresolved, so it stays killed.")
    }

    /// The captured stack is never regenerated — only the duration changes.
    func testHeartbeatDoesNotDisturbTheCapturedStack() throws {
        startHang(thresholdMs: 2_000)
        let eventId = try XCTUnwrap(signalProcessor.trackedAppHangEventId)
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: eventId,
                                                                       type: "app_hang",
                                                                       appHang: try JSONEncoder().encode(XCTUnwrap(trackedAppHang)),
                                                                       pendingResolution: true))

        collector.onAppHangHeartbeat(elapsedMs: 3_000)

        let payload = try XCTUnwrap(storedPayload(eventId))
        XCTAssertEqual(payload.exceptions.count, 1)
        XCTAssertEqual(payload.exceptions[0].frames?.count, 1)
        XCTAssertEqual(payload.binaryImages?.count, 1)
    }

    func testHeartbeatIsIgnored_whenNoHangIsPending() {
        collector.onAppHangHeartbeat(elapsedMs: 3_000)

        XCTAssertTrue(eventStore.getAllEvents().isEmpty)
    }

    // MARK: - Hang resolution

    func testRecoveryRewritesTheEventAndClearsTheMarker() throws {
        startHang(thresholdMs: 2_000, timestamp: 1_000_000)
        let eventId = try XCTUnwrap(signalProcessor.trackedAppHangEventId)

        collector.onAppHangEnded(durationMs: 3_184)

        let payload = try XCTUnwrap(resolvedPayload(eventId))
        XCTAssertEqual(payload.state, .recovered)
        XCTAssertEqual(payload.duration, 3_184)
    }

    func testRecoveryMarksTheTimeline() {
        configProvider.appHangReplayEnabled = true
        configProvider.appHangTimelineDurationSeconds = 120
        startHang(timestamp: 1_000_000)

        collector.onAppHangEnded(durationMs: 3_184)

        XCTAssertEqual(eventStore.lastMarkTimelineDurationSeconds, 120)
    }

    func testRecoveryDoesNotMarkTheTimeline_whenReplayDisabled() {
        configProvider.appHangReplayEnabled = false
        startHang()

        collector.onAppHangEnded(durationMs: 3_184)

        XCTAssertNil(eventStore.lastMarkTimelineDurationSeconds)
    }

    func testResolutionIsIgnored_whenNoHangIsPending() {
        collector.onAppHangEnded(durationMs: 3_184)

        XCTAssertTrue(eventStore.resolvedAppHangs.isEmpty)
    }

    // MARK: - Discarding

    /// A hang past the false positive ceiling must not be left pending, or the next launch would
    /// find it and report it as fatal.
    func testDiscardRemovesTheEventAndClearsTheMarker() throws {
        startHang()
        let eventId = try XCTUnwrap(signalProcessor.trackedAppHangEventId)
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: eventId, type: "app_hang", pendingResolution: true))

        collector.onAppHangDiscarded(reason: "above the ceiling")

        XCTAssertNil(eventStore.getEvents(eventIds: [eventId]))
    }

    /// Backgrounding suspends the process, which is indistinguishable from dying while hung.
    func testDisableDiscardsAnOutstandingHang() throws {
        collector.enable()
        startHang()
        let eventId = try XCTUnwrap(signalProcessor.trackedAppHangEventId)
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: eventId, type: "app_hang", pendingResolution: true))

        collector.disable()

        XCTAssertNil(eventStore.getEvents(eventIds: [eventId]))
    }

    func testDisableIsHarmless_whenNoHangIsPending() {
        collector.enable()

        collector.disable()

    }

    func testResolutionAfterDiscardIsIgnored() throws {
        startHang()
        collector.onAppHangDiscarded(reason: "above the ceiling")

        collector.onAppHangEnded(durationMs: 3_184)

        XCTAssertTrue(eventStore.resolvedAppHangs.isEmpty, "A discarded hang has nothing left to resolve.")
    }

    // MARK: - Consecutive hangs

    func testASecondHangGetsItsOwnEvent() throws {
        startHang(timestamp: 1_000_000)
        let first = try XCTUnwrap(signalProcessor.trackedAppHangEventId)
        collector.onAppHangEnded(durationMs: 3_000)

        startHang(timestamp: 2_000_000)
        let second = try XCTUnwrap(signalProcessor.trackedAppHangEventId)
        collector.onAppHangEnded(durationMs: 4_000)

        XCTAssertNotEqual(first, second)
        XCTAssertEqual(eventStore.resolvedAppHangs.count, 2)
    }
    // MARK: - Previous launch

    /// The whole point of the two-phase write: a hang the process did not survive is reported at
    /// the next launch, with the duration the heartbeat got to before the kill.
    func testFatalHangFromAPreviousLaunchIsReported() throws {
        let eventId = seedPreviousLaunchRecord(storedDurationMs: 9_000)

        collector.onConfigLoaded()

        let payload = try XCTUnwrap(resolvedPayload(eventId))
        XCTAssertEqual(payload.state, .killed, "It was written killed and stayed killed.")
        XCTAssertEqual(payload.duration, 9_000, "The heartbeat value beats the stored threshold.")
    }

    /// Sampling was decided when the hang was detected and is carried on the row, so the
    /// sampler's current answer is irrelevant at resolution time.
    func testFatalHangResolutionIgnoresTheCurrentSamplerState() throws {
        signalSampler.shouldSampleAppHangReturnValue = false
        let eventId = seedPreviousLaunchRecord(needsReporting: true)

        collector.onConfigLoaded()

        XCTAssertNotNil(resolvedPayload(eventId))
        XCTAssertTrue(sessionStore.updatedNeedsReporting["previous-session"] ?? false)
    }

    /// A fatal hang that sampled out is still released from `pendingResolution` so it can appear
    /// in a timeline, but it does not pull its session into an export.
    func testSampledOutFatalHangIsResolvedButNotReported() throws {
        let eventId = seedPreviousLaunchRecord(needsReporting: false)

        collector.onConfigLoaded()

        XCTAssertNotNil(resolvedPayload(eventId), "It must stop being pending or it is stuck forever.")
        XCTAssertNil(sessionStore.updatedNeedsReporting["previous-session"])
        XCTAssertNil(eventStore.lastMarkTimelineDurationSeconds)
    }

    /// Without this the session is deleted by cleanup and the event goes with it.
    func testFatalHangMarksThePreviousSessionForReporting() {
        seedPreviousLaunchRecord()

        collector.onConfigLoaded()

        XCTAssertTrue(sessionStore.updatedNeedsReporting["previous-session"] ?? false)
    }

    /// The process died inside the first heartbeat interval, so the duration is still the
    /// threshold it was detected at. The hang must be reported all the same.
    func testFatalHangIsReported_whenTheHeartbeatNeverRan() throws {
        let eventId = seedPreviousLaunchRecord(storedDurationMs: 2_000)

        collector.onConfigLoaded()

        let payload = try XCTUnwrap(resolvedPayload(eventId))
        XCTAssertEqual(payload.state, .killed)
        XCTAssertEqual(payload.duration, 2_000)
    }

    /// Otherwise a pending row would sit unexportable forever.
    func testNoUnresolvedRowsSurvive() {
        seedPreviousLaunchRecord(eventId: "heartbeat-ran", storedDurationMs: 9_000)
        seedPreviousLaunchRecord(eventId: "heartbeat-never-ran", storedDurationMs: 2_000)

        collector.onConfigLoaded()

        XCTAssertTrue(eventStore.getUnresolvedAppHangs().isEmpty)
    }

    func testFatalHangMarksTheTimeline() {
        configProvider.appHangReplayEnabled = true
        configProvider.appHangTimelineDurationSeconds = 120
        seedPreviousLaunchRecord()

        collector.onConfigLoaded()

        XCTAssertEqual(eventStore.lastMarkTimelineDurationSeconds, 120,
                       "Resolution runs after config load so this is the served value, not the default.")
    }

    func testFatalHangDoesNotMarkTheTimeline_whenReplayDisabled() {
        configProvider.appHangReplayEnabled = false
        seedPreviousLaunchRecord()

        collector.onConfigLoaded()

        XCTAssertNil(eventStore.lastMarkTimelineDurationSeconds)
    }

    /// iOS kills a genuinely hung foreground app well before 30s, so anything longer means the
    /// process was suspended with a hang outstanding.
    func testHangAtOrAboveTheCeilingIsDiscarded() {
        let eventId = seedPreviousLaunchRecord(storedDurationMs: 30_000)

        collector.onConfigLoaded()

        XCTAssertTrue(eventStore.resolvedAppHangs.isEmpty)
        XCTAssertNil(eventStore.getEvents(eventIds: [eventId]))
    }

    func testHangJustBelowTheCeilingIsKept() throws {
        let eventId = seedPreviousLaunchRecord(storedDurationMs: 29_999)

        collector.onConfigLoaded()

        XCTAssertEqual(try XCTUnwrap(resolvedPayload(eventId)).duration, 29_999)
    }

    /// A pending row in the current session belongs to this launch, not a dead one.
    func testPendingRowInTheCurrentSessionIsNotReported() {
        seedPreviousLaunchRecord(sessionId: sessionId)

        collector.onConfigLoaded()

        XCTAssertTrue(eventStore.resolvedAppHangs.isEmpty)
    }

    /// The crash happened between resolution and deleting the record.
    func testAlreadyResolvedEventIsNotReportedAgain() {
        let eventId = seedPreviousLaunchRecord(pendingResolution: false)

        collector.onConfigLoaded()

        XCTAssertTrue(eventStore.resolvedAppHangs.isEmpty)
        XCTAssertNotNil(eventStore.getEvents(eventIds: [eventId]), "The resolved event stays put.")
    }

    func testNothingHappens_whenThereAreNoRecords() {
        collector.onConfigLoaded()

        XCTAssertTrue(eventStore.resolvedAppHangs.isEmpty)
    }

    /// Config can load while a hang is in progress. That hang is this process's business, not a
    /// leftover, and resolving it now would report a live hang as fatal.
    func testInFlightHangIsNotTreatedAsAPreviousLaunch() throws {
        startHang()
        let eventId = try XCTUnwrap(signalProcessor.trackedAppHangEventId)

        collector.onAppHangHeartbeat(elapsedMs: 3_000)
        collector.onConfigLoaded()

        XCTAssertTrue(eventStore.resolvedAppHangs.isEmpty)

        collector.onAppHangEnded(durationMs: 3_184)
        XCTAssertEqual(try XCTUnwrap(resolvedPayload(eventId)).state, .recovered)
    }
}
