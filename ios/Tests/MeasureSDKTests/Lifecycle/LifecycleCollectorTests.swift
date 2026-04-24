//
//  LifecycleCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 24/04/25.
//

import XCTest
import UIKit
@testable import Measure

class MockViewController: UIViewController {}

final class LifecycleCollectorTests: XCTestCase {
    private var lifecycleCollector: BaseLifecycleCollector!
    private var mockSignalProcessor: MockSignalProcessor!
    private var mockTimeProvider: MockTimeProvider!
    private var mockTracer: MockTracer!
    private var mockConfigProvider: MockConfigProvider!
    private var mockLogger: MockLogger!
    private var mockViewController: MockViewController!
    private var mockSessionManager: MockSessionManager!
    private var mockSignalSampler: MockSignalSampler!

    override func setUp() {
        super.setUp()
        mockSignalProcessor = MockSignalProcessor()
        mockTimeProvider = MockTimeProvider()
        mockTracer = MockTracer()
        mockConfigProvider = MockConfigProvider()
        mockLogger = MockLogger()
        mockViewController = MockViewController()
        mockSessionManager = MockSessionManager()
        mockSignalSampler = MockSignalSampler()

        lifecycleCollector = BaseLifecycleCollector(
            signalProcessor: mockSignalProcessor,
            timeProvider: mockTimeProvider,
            tracer: mockTracer,
            configProvider: mockConfigProvider,
            sessionManager: mockSessionManager,
            logger: mockLogger,
            signalSampler: mockSignalSampler
        )
    }

    override func tearDown() {
        lifecycleCollector = nil
        mockSignalProcessor = nil
        mockTimeProvider = nil
        mockTracer = nil
        mockConfigProvider = nil
        mockLogger = nil
        mockViewController = nil
        mockSessionManager = nil
        mockSignalSampler = nil
        super.tearDown()
    }

    func testEnable() {
        lifecycleCollector.enable()
        XCTAssertTrue(mockLogger.logs.contains("LifecycleCollector enabled."))
    }

    func testDisable() {
        lifecycleCollector.enable()
        lifecycleCollector.disable()
        XCTAssertTrue(mockLogger.logs.contains("LifecycleCollector disabled."))
    }

    func testEnable_isIdempotent() {
        lifecycleCollector.enable()
        lifecycleCollector.enable()
        let enableLogs = mockLogger.logs.filter { $0 == "LifecycleCollector enabled." }
        XCTAssertEqual(enableLogs.count, 1, "enable() should only log once even if called multiple times")
    }

    func testDisable_whenNotEnabled_doesNothing() {
        lifecycleCollector.disable()
        XCTAssertFalse(mockLogger.logs.contains("LifecycleCollector disabled."))
    }

    func testApplicationDidLaunch_tracksForegroundEvent() {
        lifecycleCollector.applicationDidLaunch()

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? ApplicationLifecycleData {
            XCTAssertEqual(lifecycleData.type, .foreground)
        } else {
            XCTFail("Data should be of type ApplicationLifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleApp)
    }

    func testApplicationDidLaunch_calledTwice_tracksOnlyOnce() {
        lifecycleCollector.applicationDidLaunch()
        let countAfterFirst = mockSignalProcessor.trackEventCallCount

        lifecycleCollector.applicationDidLaunch()
        let countAfterSecond = mockSignalProcessor.trackEventCallCount

        XCTAssertEqual(countAfterFirst, countAfterSecond, "applicationDidLaunch should only track once regardless of how many times it is called")
    }

    func testApplicationWillEnterForeground_beforeApplicationDidLaunch_doesNotTrack() {
        lifecycleCollector.applicationWillEnterForeground()

        XCTAssertNil(mockSignalProcessor.data, "applicationWillEnterForeground should not track before applicationDidLaunch is called")
    }

    func testApplicationWillEnterForeground_afterApplicationDidLaunch_tracksForegroundEvent() {
        lifecycleCollector.applicationDidLaunch()

        lifecycleCollector.applicationWillEnterForeground()

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? ApplicationLifecycleData {
            XCTAssertEqual(lifecycleData.type, .foreground)
        } else {
            XCTFail("Data should be of type ApplicationLifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleApp)
    }

    func testApplicationDidEnterBackground() {
        lifecycleCollector.applicationDidEnterBackground()

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? ApplicationLifecycleData {
            XCTAssertEqual(lifecycleData.type, .background)
        } else {
            XCTFail("Data should be of type ApplicationLifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleApp)
    }

    func testApplicationWillTerminate() {
        lifecycleCollector.applicationWillTerminate()

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? ApplicationLifecycleData {
            XCTAssertEqual(lifecycleData.type, .terminated)
        } else {
            XCTFail("Data should be of type ApplicationLifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleApp)
    }

    func testProcessControllerLifecycleEvent_LoadView() {
        lifecycleCollector.enable()
        lifecycleCollector.processControllerLifecycleEvent(.loadView, for: mockViewController)

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? VCLifecycleData {
            XCTAssertEqual(lifecycleData.type, "loadView")
            XCTAssertTrue(lifecycleData.className.contains("MockViewController"))
        } else {
            XCTFail("Data should be of type VCLifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleViewController)
    }

    func testProcessControllerLifecycleEvent_ViewDidLoad() {
        lifecycleCollector.enable()
        lifecycleCollector.processControllerLifecycleEvent(.viewDidLoad, for: mockViewController)

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? VCLifecycleData {
            XCTAssertEqual(lifecycleData.type, "viewDidLoad")
            XCTAssertTrue(lifecycleData.className.contains("MockViewController"))
        } else {
            XCTFail("Data should be of type VCLifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleViewController)
    }

    func testProcessControllerLifecycleEvent_ViewWillAppear() {
        lifecycleCollector.enable()
        lifecycleCollector.processControllerLifecycleEvent(.viewWillAppear, for: mockViewController)

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? VCLifecycleData {
            XCTAssertEqual(lifecycleData.type, "viewWillAppear")
            XCTAssertTrue(lifecycleData.className.contains("MockViewController"))
        } else {
            XCTFail("Data should be of type VCLifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleViewController)
    }

    func testProcessControllerLifecycleEvent_ViewDidAppear() {
        lifecycleCollector.enable()
        lifecycleCollector.processControllerLifecycleEvent(.viewDidAppear, for: mockViewController)

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? VCLifecycleData {
            XCTAssertEqual(lifecycleData.type, "viewDidAppear")
            XCTAssertTrue(lifecycleData.className.contains("MockViewController"))
        } else {
            XCTFail("Data should be of type VCLifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleViewController)
    }

    func testProcessControllerLifecycleEvent_whenDisabled_doesNotTrack() {
        lifecycleCollector.processControllerLifecycleEvent(.viewDidLoad, for: mockViewController)

        XCTAssertNil(mockSignalProcessor.data, "VC lifecycle events should not be tracked when collector is disabled")
    }

    func testProcessControllerLifecycleEvent_whenInExcludeList_doesNotTrack() {
        lifecycleCollector.enable()
        mockConfigProvider.lifecycleViewControllerExcludeList = ["MockViewController"]

        lifecycleCollector.processControllerLifecycleEvent(.viewDidLoad, for: mockViewController)

        XCTAssertNil(mockSignalProcessor.data, "VC lifecycle events should not be tracked for excluded view controllers")
    }

    func testProcessSwiftUILifecycleEvent_onAppear() {
        let className = "TestView"
        lifecycleCollector.processSwiftUILifecycleEvent(.onAppear, for: className)

        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? SwiftUILifecycleData {
            XCTAssertEqual(lifecycleData.type, .onAppear)
            XCTAssertEqual(lifecycleData.className, className)
        } else {
            XCTFail("Data should be of type SwiftUILifecycleData")
        }
        XCTAssertEqual(mockSignalProcessor.type, .lifecycleSwiftUI)
    }

    func testViewControllerTTIDSpanTracking() {
        lifecycleCollector.enable()

        // Start span in loadView
        lifecycleCollector.processControllerLifecycleEvent(.loadView, for: mockViewController)
        XCTAssertNotNil(mockTracer.lastSpan)

        // Add checkpoint in viewDidLoad
        lifecycleCollector.processControllerLifecycleEvent(.viewDidLoad, for: mockViewController)

        // Add checkpoint in viewWillAppear
        lifecycleCollector.processControllerLifecycleEvent(.viewWillAppear, for: mockViewController)

        // End span in viewDidAppear
        lifecycleCollector.processControllerLifecycleEvent(.viewDidAppear, for: mockViewController)

        // Wait for the async operation to complete
        let expectation = XCTestExpectation(description: "Wait for span status update")
        DispatchQueue.main.async {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 0.5)

        // Verify span was ended with OK status
        XCTAssertEqual(mockTracer.lastSpan?.status, .ok)
    }

    func testTrackEvent_whenSamplerReturnsFalse_needsReportingIsFalse() {
        mockSignalSampler.shouldTrackLaunchEventsReturnValue = false

        lifecycleCollector.applicationDidEnterBackground()

        XCTAssertEqual(mockSignalProcessor.needsReporting, false, "needsReporting should be false when signal sampler returns false")
    }

    func testTrackEvent_whenSamplerReturnsTrue_needsReportingIsTrue() {
        mockSignalSampler.shouldTrackLaunchEventsReturnValue = true

        lifecycleCollector.applicationDidEnterBackground()

        XCTAssertEqual(mockSignalProcessor.needsReporting, true, "needsReporting should be true when signal sampler returns true")
    }
}
