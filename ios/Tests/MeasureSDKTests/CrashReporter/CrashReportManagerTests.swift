//
//  CrashReportManagerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 12/03/26.
//

import XCTest
@testable import Measure

final class CrashReportingManagerTests: XCTestCase {
    var reporter: MockSystemCrashReporter!
    var signalProcessor: MockSignalProcessor!
    var persistence: MockCrashDataPersistence!
    var logger: MockLogger!
    var systemFileManager: MockSystemFileManager!
    var idProvider: MockIdProvider!
    var configProvider: MockConfigProvider!
    var crashReportingManager: BaseCrashReportingManager!

    override func setUp() {
        super.setUp()
        reporter = MockSystemCrashReporter()
        signalProcessor = MockSignalProcessor()
        persistence = MockCrashDataPersistence(
            attribute: Attributes(appVersion: "1.0", appBuild: "100"),
            sessionId: "session-123",
            isForeground: false
        )
        logger = MockLogger()
        systemFileManager = MockSystemFileManager()
        idProvider = MockIdProvider()
        configProvider = MockConfigProvider()
    }

    override func tearDown() {
        crashReportingManager = nil
        reporter = nil
        signalProcessor = nil
        persistence = nil
        logger = nil
        systemFileManager = nil
        idProvider = nil
        configProvider = nil
        super.tearDown()
    }

    private func makeReportDict(timestamp: TimeInterval? = 1_700_000_000) -> [String: Any] {
        var report: [String: Any] = [
            "crash": ["error": [:], "threads": []] as [String: Any],
            "binary_images": [],
            "system": [:]
        ]
        if let ts = timestamp {
            report["report"] = ["timestamp": ts]
        }
        return report
    }

    func test_trackException_doesNothingWhenNoPendingCrashReport() {
        reporter.hasPendingCrashReport = false
        trackException()
        XCTAssertFalse(reporter.loadCrashReportCalled)
        XCTAssertFalse(reporter.clearCrashDataCalled)
        XCTAssertNil(signalProcessor.type)
    }

    func test_trackException_doesNotTrackWhenLoadCrashReportThrows() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = nil
        trackException()
        XCTAssertNil(signalProcessor.type)
    }

    func test_trackException_doesNotTrackWhenAttributesAreNil() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        persistence.attribute = nil
        trackException()
        XCTAssertNil(signalProcessor.type)
    }

    func test_trackException_doesNotTrackWhenSessionIdIsNil() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        persistence.sessionId = nil
        trackException()
        XCTAssertNil(signalProcessor.type)
    }

    func test_trackException_callsLoadCrashReport() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        trackException()
        XCTAssertTrue(reporter.loadCrashReportCalled)
    }

    func test_trackException_tracksWithExceptionType() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        trackException()
        XCTAssertEqual(signalProcessor.type, .exception)
    }

    func test_trackException_tracksWithCorrectSessionId() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        persistence.sessionId = "my-session"
        trackException()
        XCTAssertEqual(signalProcessor.sessionId, "my-session")
    }

    func test_trackException_tracksWithNeedsReportingTrue() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        trackException()
        XCTAssertEqual(signalProcessor.needsReporting, true)
    }

    func test_trackException_tracksWithNilAttachments() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        trackException()
        XCTAssertNil(signalProcessor.attachments)
    }

    func test_trackException_tracksWithNilUserDefinedAttributes() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        trackException()
        XCTAssertNil(signalProcessor.userDefinedAttributes)
    }

    func test_trackException_tracksWithAttributesFromPersistence() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        persistence.attribute = Attributes(appVersion: "2.0", appBuild: "200", measureSdkVersion: "1.2.3")
        trackException()
        XCTAssertEqual(signalProcessor.attributes?.appVersion, "2.0")
        XCTAssertEqual(signalProcessor.attributes?.appBuild, "200")
        XCTAssertEqual(signalProcessor.attributes?.measureSdkVersion, "1.2.3")
    }

    func test_trackException_overridesForegroundTrueFromPersistence() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        persistence.isForeground = true
        trackException()
        let exception = signalProcessor.data as? Exception
        XCTAssertEqual(exception?.foreground, true)
    }

    func test_trackException_overridesForegroundFalseFromPersistence() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        persistence.isForeground = false
        trackException()
        let exception = signalProcessor.data as? Exception
        XCTAssertEqual(exception?.foreground, false)
    }

    func test_trackException_usesReportTimestampInMilliseconds() {
        let ts: TimeInterval = 1_700_000_000
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict(timestamp: ts)
        trackException()
        XCTAssertEqual(signalProcessor.timestamp, Number(ts * 1000))
    }

    func test_trackException_clearsCrashReporterDataAfterTracking() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        trackException()
        XCTAssertTrue(reporter.clearCrashDataCalled)
    }

    func test_trackException_clearsPersistenceDataAfterTracking() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        trackException()
        XCTAssertNil(persistence.attribute)
        XCTAssertNil(persistence.sessionId)
    }

    func test_trackException_ClearReporterWhenLoadThrows() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = nil
        trackException()
        XCTAssertTrue(reporter.clearCrashDataCalled)
    }

    func test_trackException_ClearPersistenceWhenLoadThrows() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = nil
        trackException()
        XCTAssertNil(persistence.attribute)
    }

    func test_trackException_ClearReporterWhenAttributesNil() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        persistence.attribute = nil
        trackException()
        XCTAssertTrue(reporter.clearCrashDataCalled)
    }

    func test_trackException_ClearPersistenceWhenSessionIdNil() {
        reporter.hasPendingCrashReport = true
        reporter.reportToReturn = makeReportDict()
        persistence.sessionId = nil
        trackException()
        XCTAssertNil(persistence.attribute)
    }

    private func trackException() {
        crashReportingManager = BaseCrashReportingManager(logger: logger,
                                                          signalProcessor: signalProcessor,
                                                          crashDataPersistence: persistence,
                                                          crashReporter: reporter,
                                                          systemFileManager: systemFileManager,
                                                          idProvider: idProvider,
                                                          configProvider: configProvider)
        crashReportingManager.trackException {}
    }
}
