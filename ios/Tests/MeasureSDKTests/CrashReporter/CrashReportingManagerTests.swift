//
//  CrashReportingManagerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/24.
//

@testable import Measure
import XCTest
import CrashReporter

final class CrashReportingManagerTests: XCTestCase {
    var crashReportingManager: CrashReportingManager!
    var signalProcessor: MockSignalProcessor!
    var crashDataPersistence: MockCrashDataPersistence!
    var systemCrashReporter: MockSystemCrashReporter!
    var systemFileManager: MockSystemFileManager!
    var idProvider: MockIdProvider!
    var configProvider: MockConfigProvider!

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
        signalProcessor = MockSignalProcessor()
        if let data = fileManagerHelper.loadFileData(fileName: "backgroundThreadException", fileExtension: "plcrash") {
            systemCrashReporter = MockSystemCrashReporter(hasPendingCrashReport: true,
                                                          crashData: data)
        }
        systemFileManager = MockSystemFileManager()
        idProvider = MockIdProvider()
        idProvider.uuId = "uuid"
        configProvider = MockConfigProvider()
        crashReportingManager = CrashReportingManager(logger: MockLogger(),
                                                      signalProcessor: signalProcessor,
                                                      crashDataPersistence: crashDataPersistence,
                                                      crashReporter: systemCrashReporter,
                                                      systemFileManager: systemFileManager,
                                                      idProvider: idProvider,
                                                      configProvider: configProvider)
        crashReportingManager.enable()
    }

    override func tearDown() {
        super.tearDown()
        crashReportingManager = nil
        signalProcessor = nil
        crashDataPersistence = nil
        systemCrashReporter = nil
        systemFileManager = nil
        idProvider = nil
        configProvider = nil
    }

    func testInsertSession() {
        crashReportingManager.trackException()
        XCTAssertEqual(signalProcessor.attachments, nil)
        XCTAssertEqual(signalProcessor.sessionId, "session-id")
        XCTAssertEqual(signalProcessor.type, .exception)
        XCTAssertEqual(signalProcessor.attributes, attributes)

        XCTAssertEqual(signalProcessor.timestamp, 1726903016000)
        guard let exceptionJson = fileManagerHelper.getException(fileName: "backgroundThreadException", fileExtension: "json"), let eventException = signalProcessor.data as? Exception else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }
        XCTAssertEqual(eventException, exceptionJson)
    }
}
