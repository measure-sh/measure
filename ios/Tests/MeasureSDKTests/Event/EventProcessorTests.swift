//
//  signalProcessorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

@testable import Measure
import XCTest

final class SignalProcessorTests: XCTestCase {
    var signalProcessor: SignalProcessor!
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
    var spanStore: MockSpanStore!
    var screenshotGenerator: MockScreenshotGenerator!
    var fileManagerHelper = FileManagerHelper()
    var signalSampler: MockSignalSampler!
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
        idProvider = MockIdProvider()
        idProvider.uuId = "event-id"
        logger = MockLogger()
        timeProvider = BaseTimeProvider()
        configProvider = MockConfigProvider(enableDebugMode: false,
                                            trackScreenshotOnCrash: false,
                                            samplingRateForErrorFreeSessions: 1.0,
                                            eventsBatchingIntervalMs: 1000,
                                            sessionEndLastEventThresholdMs: 1000,
                                            longPressTimeout: 0.5,
                                            scaledTouchSlop: 20,
                                            maxAttachmentSizeInEventsBatchInBytes: 30000,
                                            maxEventsInBatch: 500)
        randomizer = MockRandomizer()
        randomizer.randomFloat = 0.5
        coreDataManager = MockCoreDataManager()
        sessionStore = BaseSessionStore(coreDataManager: coreDataManager,
                                        logger: logger)
        crashDataPersistence = MockCrashDataPersistence(attribute: nil,
                                                        sessionId: "",
                                                        isForeground: true)
        sessionManager = MockSessionManager(sessionId: "session-id-1")
        screenshotGenerator = MockScreenshotGenerator()
        eventStore = MockEventStore()
        spanStore = MockSpanStore()
        signalSampler = MockSignalSampler()
    }

    override func tearDown() {
        super.tearDown()
        signalProcessor = nil
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
        screenshotGenerator = nil
        signalSampler = nil
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
        signalProcessor = BaseSignalProcessor(logger: logger,
                                              idProvider: idProvider,
                                              sessionManager: sessionManager,
                                              attributeProcessors: [attributeProcessor],
                                              configProvider: configProvider,
                                              timeProvider: BaseTimeProvider(),
                                              crashDataPersistence: crashDataPersistence,
                                              eventStore: eventStore,
                                              spanStore: spanStore,
                                              measureDispatchQueue: MockMeasureDispatchQueue(),
                                              signalSampler: signalSampler)
        signalProcessor.track(data: exception,
                             timestamp: 1_000_000_000,
                             type: .exception,
                             attributes: nil,
                             sessionId: nil,
                             attachments: [MsrAttachment(name: "file-name", type: .screenshot, size: 10, id: "id", path: "file-path")],
                             userDefinedAttributes: nil,
                             threadName: nil)

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
        XCTAssertEqual(event.attachments?.first?.name, "file-name")
        XCTAssertEqual(event.attachments?.first?.type, .screenshot)
        XCTAssertEqual(event.attachments?.first?.size, 10)
        XCTAssertEqual(event.attachments?.first?.id, "id")
        XCTAssertEqual(event.attachments?.first?.path, "file-path")
        XCTAssertEqual(event.userTriggered, false)
        XCTAssertEqual(event.attributes, attributes)
        XCTAssertEqual(event.exception, exception)
    }

    func testTrackExceptionEventWithAllData() { // swiftlint:disable:this function_body_length
        guard let exception = fileManagerHelper.getException(fileName: "abort", fileExtension: "json") else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }
        let attributeProcessor = MockAttributeProcessor { attributes in
            attributes.threadName = "com.thread.main"
        }
        signalProcessor = BaseSignalProcessor(logger: logger,
                                              idProvider: idProvider,
                                              sessionManager: sessionManager,
                                              attributeProcessors: [attributeProcessor],
                                              configProvider: configProvider,
                                              timeProvider: BaseTimeProvider(),
                                              crashDataPersistence: crashDataPersistence,
                                              eventStore: eventStore,
                                              spanStore: spanStore,
                                              measureDispatchQueue: MockMeasureDispatchQueue(),
                                              signalSampler: signalSampler)
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
        signalProcessor.track(data: exception,
                             timestamp: 1_000_000_000,
                             type: .exception,
                             attributes: attributes,
                             sessionId: "session-id-2",
                             attachments: [MsrAttachment(name: "file-name", type: .screenshot, size: 10, id: "id", path: "file-path")],
                             userDefinedAttributes: nil,
                             threadName: nil)

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
        XCTAssertEqual(event.attachments?.first?.name, "file-name")
        XCTAssertEqual(event.attachments?.first?.type, .screenshot)
        XCTAssertEqual(event.attachments?.first?.size, 10)
        XCTAssertEqual(event.attachments?.first?.id, "id")
        XCTAssertEqual(event.attachments?.first?.path, "file-path")
        XCTAssertEqual(event.userTriggered, false)
        XCTAssertEqual(event.attributes, updatedAttributes)
        XCTAssertEqual(event.exception, exception)
    }

    func testLaunchEventTracked_whenSessionShouldReportSessionIsTrue_evenIfSamplingIsFalse() {
        sessionManager.shouldReportSession = true
        signalSampler.shouldTrackLaunchEventsReturnValue = false
        signalSampler.shouldTrackJourneyEventsReturnValue = false

        signalProcessor = BaseSignalProcessor(
            logger: logger,
            idProvider: idProvider,
            sessionManager: sessionManager,
            attributeProcessors: [],
            configProvider: configProvider,
            timeProvider: BaseTimeProvider(),
            crashDataPersistence: crashDataPersistence,
            eventStore: eventStore,
            spanStore: spanStore,
            measureDispatchQueue: MockMeasureDispatchQueue(),
            signalSampler: signalSampler
        )

        signalProcessor.track(
            data: "Test",
            timestamp: 1234,
            type: .coldLaunch,
            attributes: nil,
            sessionId: nil,
            attachments: nil,
            userDefinedAttributes: nil,
            threadName: nil
        )

        XCTAssertEqual(eventStore.events.first?.needsReporting, true, "Event should be tracked when sessionShouldReportSession is true")
    }

    func testJourneyEventTracked_whenSessionShouldReportSessionIsTrue_evenIfSamplingIsFalse() {
        sessionManager.shouldReportSession = true
        signalSampler.shouldTrackLaunchEventsReturnValue = false
        signalSampler.shouldTrackJourneyEventsReturnValue = false

        signalProcessor = BaseSignalProcessor(
            logger: logger,
            idProvider: idProvider,
            sessionManager: sessionManager,
            attributeProcessors: [],
            configProvider: configProvider,
            timeProvider: BaseTimeProvider(),
            crashDataPersistence: crashDataPersistence,
            eventStore: eventStore,
            spanStore: spanStore,
            measureDispatchQueue: MockMeasureDispatchQueue(),
            signalSampler: signalSampler
        )

        signalProcessor.track(
            data: "Test",
            timestamp: 1234,
            type: .screenView,
            attributes: nil,
            sessionId: nil,
            attachments: nil,
            userDefinedAttributes: nil,
            threadName: nil
        )

        XCTAssertEqual(eventStore.events.first?.needsReporting, true, "Event should be tracked when sessionShouldReportSession is true")
    }

    func testEventTracked_whenLaunchSamplingAllows_evenIfSessionShouldReportIsFalse() {
        sessionManager.shouldReportSession = false
        signalSampler.shouldTrackLaunchEventsReturnValue = true
        signalSampler.shouldTrackJourneyEventsReturnValue = false

        signalProcessor = BaseSignalProcessor(
            logger: logger,
            idProvider: idProvider,
            sessionManager: sessionManager,
            attributeProcessors: [],
            configProvider: configProvider,
            timeProvider: BaseTimeProvider(),
            crashDataPersistence: crashDataPersistence,
            eventStore: eventStore,
            spanStore: spanStore,
            measureDispatchQueue: MockMeasureDispatchQueue(),
            signalSampler: signalSampler
        )

        signalProcessor.track(
            data: "Test",
            timestamp: 1234,
            type: .coldLaunch,
            attributes: nil,
            sessionId: nil,
            attachments: nil,
            userDefinedAttributes: nil,
            threadName: nil
        )

        XCTAssertEqual(eventStore.events.first?.needsReporting, true, "Event should be tracked when launch sampling allows it")
    }

    func testEventTracked_whenJourneySamplingAllows_evenIfSessionShouldReportIsFalse() {
        sessionManager.shouldReportSession = false
        signalSampler.shouldTrackLaunchEventsReturnValue = false
        signalSampler.shouldTrackJourneyEventsReturnValue = true

        signalProcessor = BaseSignalProcessor(
            logger: logger,
            idProvider: idProvider,
            sessionManager: sessionManager,
            attributeProcessors: [],
            configProvider: configProvider,
            timeProvider: BaseTimeProvider(),
            crashDataPersistence: crashDataPersistence,
            eventStore: eventStore,
            spanStore: spanStore,
            measureDispatchQueue: MockMeasureDispatchQueue(),
            signalSampler: signalSampler
        )

        signalProcessor.track(
            data: "Test",
            timestamp: 1234,
            type: .screenView,
            attributes: nil,
            sessionId: nil,
            attachments: nil,
            userDefinedAttributes: nil,
            threadName: nil
        )

        XCTAssertEqual(eventStore.events.first?.needsReporting, true, "Event should be tracked when journey sampling allows it")
    }

    func testEventNotTracked_whenSessionFalse_andSamplingFalse_andNotInAllowList() {
        sessionManager.shouldReportSession = false
        signalSampler.shouldTrackLaunchEventsReturnValue = false
        signalSampler.shouldTrackJourneyEventsReturnValue = false

        configProvider.eventTypeExportAllowList = []

        signalProcessor = BaseSignalProcessor(
            logger: logger,
            idProvider: idProvider,
            sessionManager: sessionManager,
            attributeProcessors: [],
            configProvider: configProvider,
            timeProvider: BaseTimeProvider(),
            crashDataPersistence: crashDataPersistence,
            eventStore: eventStore,
            spanStore: spanStore,
            measureDispatchQueue: MockMeasureDispatchQueue(),
            signalSampler: signalSampler
        )

        signalProcessor.track(
            data: "Test",
            timestamp: 1234,
            type: .coldLaunch,
            attributes: nil,
            sessionId: nil,
            attachments: nil,
            userDefinedAttributes: nil,
            threadName: nil
        )

        XCTAssertEqual(eventStore.events.first?.needsReporting, false, "Event should NOT be tracked when session=false and sampling=false")
    }

    func testEventTracked_whenInAllowList_evenIfSessionFalse_andSamplingFalse() {
        sessionManager.shouldReportSession = false
        signalSampler.shouldTrackLaunchEventsReturnValue = false
        signalSampler.shouldTrackJourneyEventsReturnValue = false

        configProvider.eventTypeExportAllowList = [.sessionStart]

        signalProcessor = BaseSignalProcessor(
            logger: logger,
            idProvider: idProvider,
            sessionManager: sessionManager,
            attributeProcessors: [],
            configProvider: configProvider,
            timeProvider: BaseTimeProvider(),
            crashDataPersistence: crashDataPersistence,
            eventStore: eventStore,
            spanStore: spanStore,
            measureDispatchQueue: MockMeasureDispatchQueue(),
            signalSampler: signalSampler
        )

        signalProcessor.track(
            data: "Test",
            timestamp: 1234,
            type: .sessionStart,
            attributes: nil,
            sessionId: nil,
            attachments: nil,
            userDefinedAttributes: nil,
            threadName: nil
        )

        XCTAssertEqual(eventStore.events.first?.needsReporting, true, "Event should be tracked when allowList contains eventType")
    }
}
