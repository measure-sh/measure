//
//  EventProcessorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

@testable import MeasureSDK
import XCTest

final class EventProcessorTests: XCTestCase {
    var eventProcessor: EventProcessor!
    var idProvider: MockIdProvider!
    var logger: MockLogger!
    var configProvider: MockConfigProvider!
    var randomizer: MockRandomizer!
    var timeProvider: TimeProvider!
    var sessionStore: SessionStore!
    var coreDataManager: MockCoreDataManager!
    var crashDataPersistence: MockCrashDataPersistence!
    var sessionManager: MockSessionManager!
    var eventStore: MockEventStore!
    var fileManagerHelper = FileManagerHelper()
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
        idProvider = MockIdProvider("event-id")
        logger = MockLogger()
        timeProvider = SystemTimeProvider(systemTime: BaseSystemTime())
        configProvider = MockConfigProvider(enableLogging: false,
                                            trackScreenshotOnCrash: false,
                                            sessionSamplingRate: 1.0,
                                            eventsBatchingIntervalMs: 1000,
                                            sessionEndThresholdMs: 1000,
                                            longPressTimeout: 0.5,
                                            scaledTouchSlop: 20)
        randomizer = MockRandomizer(0.5)
        coreDataManager = MockCoreDataManager()
        sessionStore = BaseSessionStore(coreDataManager: coreDataManager,
                                        logger: logger)
        crashDataPersistence = MockCrashDataPersistence(attribute: nil,
                                                        sessionId: "",
                                                        isForeground: true)
        sessionManager = MockSessionManager(sessionId: "session-id-1")
        eventStore = MockEventStore()
    }

    override func tearDown() {
        super.tearDown()
        eventProcessor = nil
        idProvider = nil
        logger = nil
        configProvider = nil
        randomizer = nil
        timeProvider = nil
        sessionStore = nil
        coreDataManager = nil
        crashDataPersistence = nil
        sessionManager = nil
        eventStore = nil
    }

    func testTrackExceptionEventWithNilAttributesAndNilSessionId() {  // swiftlint:disable:this function_body_length
        guard let exception = fileManagerHelper.getException(fileName: "backgroundThreadException", fileExtension: "json") else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }
        let attributeProcessor = MockAttributeProcessor { attributes in
            attributes.threadName = "main"
            attributes.deviceName = "iPhone"
            attributes.deviceModel = "iPhone 14 Pro"
            attributes.deviceManufacturer = "Apple"
            attributes.deviceType = .phone
            attributes.deviceIsFoldable = false
            attributes.deviceIsPhysical = true
            attributes.deviceDensityDpi = 460
            attributes.deviceWidthPx = 1170
            attributes.deviceHeightPx = 2532
            attributes.deviceDensity = 3
            attributes.deviceLocale = "en_US"
            attributes.osName = "iOS"
            attributes.osVersion = "17.0"
            attributes.platform = "ios"
            attributes.networkType = .wifi
            attributes.networkGeneration = .generation5
            attributes.networkProvider = "Verizon"
            attributes.installationId = "installation-id"
            attributes.userId = "user123"
            attributes.deviceCpuArch = "arm64e"
            attributes.appVersion = "1.2.3"
            attributes.appBuild = "123"
            attributes.measureSdkVersion = "0.0.1"
            attributes.appUniqueId = "unique-id"
        }
        eventProcessor = BaseEventProcessor(logger: logger,
                                            idProvider: idProvider,
                                            sessionManager: sessionManager,
                                            attributeProcessors: [attributeProcessor],
                                            configProvider: configProvider,
                                            systemTime: BaseSystemTime(),
                                            crashDataPersistence: crashDataPersistence,
                                            eventStore: eventStore)
        eventProcessor.track(data: exception,
                             timestamp: 1_000_000_000,
                             type: .exception,
                             attributes: nil,
                             sessionId: nil,
                             attachments: [Attachment(name: "file-name", type: .screenshot, path: "file-path")])

        // Check if latest attributes are saved when an event is tracked
        XCTAssertEqual(crashDataPersistence.attribute, attributes)

        // Check if event gets added to the EventStore
        XCTAssertEqual(eventStore.events.count, 1)

        // Check if EventEntity is properly convert back to Event
        guard let event = eventStore.events.first?.getEvent() as? Event<Exception> else {
            XCTFail("Failed to get event from EventStore.")
            return
        }
        XCTAssertEqual(event.id, "event-id")
        XCTAssertEqual(event.sessionId, "session-id-1")
        XCTAssertEqual(event.timestamp, "1970-01-12T13:46:40.000Z")
        XCTAssertEqual(event.type, .exception)
        XCTAssertEqual(event.attachments?.count, 1)
        XCTAssertEqual(event.attachments?.first, Attachment(name: "file-name", type: .screenshot, path: "file-path"))
        XCTAssertEqual(event.userTriggered, false)
        XCTAssertEqual(event.attributes, attributes)
        XCTAssertEqual(event.data, exception)
    }

    func testTrackExceptionEventWithAllData() { // swiftlint:disable:this function_body_length
        guard let exception = fileManagerHelper.getException(fileName: "abort", fileExtension: "json") else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }
        let attributeProcessor = MockAttributeProcessor { attributes in
            attributes.threadName = "com.thread.main"
        }
        eventProcessor = BaseEventProcessor(logger: logger,
                                            idProvider: idProvider,
                                            sessionManager: sessionManager,
                                            attributeProcessors: [attributeProcessor],
                                            configProvider: configProvider,
                                            systemTime: BaseSystemTime(),
                                            crashDataPersistence: crashDataPersistence,
                                            eventStore: eventStore)
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
        let updatedAttributes = Attributes(
            threadName: "com.thread.main",
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
        eventProcessor.track(data: exception,
                             timestamp: 1_000_000_000,
                             type: .exception,
                             attributes: attributes,
                             sessionId: "session-id-2",
                             attachments: [Attachment(name: "file-name", type: .screenshot, path: "file-path")])

        // Check if latest attributes are saved when an event is tracked
        XCTAssertEqual(crashDataPersistence.attribute, updatedAttributes)

        // Check if event gets added to the EventStore
        XCTAssertEqual(eventStore.events.count, 1)

        // Check if EventEntity is properly convert back to Event
        guard let event = eventStore.events.first?.getEvent() as? Event<Exception> else {
            XCTFail("Failed to get event from EventStore.")
            return
        }
        XCTAssertEqual(event.id, "event-id")
        XCTAssertEqual(event.sessionId, "session-id-2")
        XCTAssertEqual(event.timestamp, "1970-01-12T13:46:40.000Z")
        XCTAssertEqual(event.type, .exception)
        XCTAssertEqual(event.attachments?.count, 1)
        XCTAssertEqual(event.attachments?.first, Attachment(name: "file-name", type: .screenshot, path: "file-path"))
        XCTAssertEqual(event.userTriggered, false)
        XCTAssertEqual(event.attributes, updatedAttributes)
        XCTAssertEqual(event.data, exception)
    }
}
