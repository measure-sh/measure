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

    override func setUp() {
        super.setUp()
        mockSignalProcessor = MockSignalProcessor()
        mockTimeProvider = MockTimeProvider()
        mockTracer = MockTracer()
        mockConfigProvider = MockConfigProvider()
        mockLogger = MockLogger()
        mockViewController = MockViewController()
        
        lifecycleCollector = BaseLifecycleCollector(
            signalProcessor: mockSignalProcessor,
            timeProvider: mockTimeProvider,
            tracer: mockTracer,
            configProvider: mockConfigProvider,
            logger: mockLogger
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

    func testApplicationWillEnterForeground() {
        lifecycleCollector.applicationWillEnterForeground()
        
        XCTAssertNotNil(mockSignalProcessor.data)
        if let lifecycleData = mockSignalProcessor.data as? ApplicationLifecycleData {
            XCTAssertEqual(lifecycleData.type, .foreground)
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

    func testProcessSwiftUILifecycleEvent() {
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
        mockConfigProvider.trackViewControllerLoadTime = true
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
}
