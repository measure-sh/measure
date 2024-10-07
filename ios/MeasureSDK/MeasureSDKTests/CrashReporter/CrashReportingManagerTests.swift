//
//  CrashReportingManagerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/24.
//

@testable import MeasureSDK
import XCTest
import CrashReporter

final class CrashReportingManagerTests: XCTestCase {
    var crashReportingManager: CrashReportingManager!
    var eventProcessor: MockEventProcessor!
    var crashDataPersistence: MockCrashDataPersistence!
    var systemCrashReporter: MockSystemCrashReporter!

    let fileManagerHelper = FileManagerHelper()
    let attributes = Attributes(
        threadName: "main",
        deviceName: "iPhone",
        deviceModel: "iPhone 14 Pro",
        deviceManufacturer: "Apple",
        deviceType: .phone,
        deviceIsFoldable: false,
        deviceIsPhysical: true,
        deviceDensityDpi: 460,
        deviceWidthPx: 1170,
        deviceHeightPx: 2532,
        deviceDensity: 3,
        deviceLocale: "en_US",
        osName: "iOS",
        osVersion: "17.0",
        platform: "ios",
        networkType: .wifi,
        networkGeneration: .generation5,
        networkProvider: "Verizon",
        installationId: "installation-id",
        userId: "user123",
        deviceCpuArch: "arm64e",
        appVersion: "1.2.3",
        appBuild: "123",
        measureSdkVersion: "0.0.1",
        appUniqueId: "unique-id"
    )

    override func setUp() {
        super.setUp()

        crashDataPersistence = MockCrashDataPersistence(attribute: attributes,
                                                        sessionId: "session-id",
                                                        isForeground: true)
        eventProcessor = MockEventProcessor()
        if let data = fileManagerHelper.loadFileData(fileName: "backgroundThreadException", fileExtension: "plcrash") {
            systemCrashReporter = MockSystemCrashReporter(hasPendingCrashReport: true,
                                                          crashData: data)
        }
        crashReportingManager = CrashReportingManager(logger: MockLogger(),
                                                      eventProcessor: eventProcessor,
                                                      crashDataPersistence: crashDataPersistence,
                                                      crashReporter: systemCrashReporter)
        crashReportingManager.enableCrashReporting()
    }

    override func tearDown() {
        super.tearDown()
        crashReportingManager = nil
        eventProcessor = nil
        crashDataPersistence = nil
        systemCrashReporter = nil
    }

    func testInsertSession() {
        crashReportingManager.trackException()
        XCTAssertEqual(eventProcessor.attachments?.count, 0)
        XCTAssertEqual(eventProcessor.sessionId, "session-id")
        XCTAssertEqual(eventProcessor.type, .exception)
        XCTAssertEqual(eventProcessor.attributes, attributes)

        XCTAssertEqual(eventProcessor.timestamp, 1726903016)
        guard let exceptionJson = fileManagerHelper.getException(fileName: "backgroundThreadException", fileExtension: "json"), let eventException = eventProcessor.data as? Exception else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }
        XCTAssertEqual(eventException, exceptionJson)
    }
}
