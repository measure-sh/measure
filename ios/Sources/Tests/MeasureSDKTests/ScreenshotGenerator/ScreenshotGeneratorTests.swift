//
//  ScreenshotGeneratorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 03/02/25.
//

import XCTest
@testable import MeasureSDK

final class ScreenshotGeneratorTests: XCTestCase {
    private var logger: MockLogger!
    private var configProvider: MockConfigProvider!
    private var attachmentProcessor: MockAttachmentProcessor!
    private var snapshotGenerator: BaseLayoutSnapshotGenerator!
    private var testWindow: UIWindow!
    private var screenshotGenerator: BaseScreenshotGenerator!
    private var userPermissionManager: MockUserPermissionManager!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        configProvider = MockConfigProvider()
        attachmentProcessor = MockAttachmentProcessor()
        userPermissionManager = MockUserPermissionManager()
        screenshotGenerator = BaseScreenshotGenerator(configProvider: configProvider,
                                                      logger: logger,
                                                      attachmentProcessor: attachmentProcessor,
                                                      userPermissionManager: userPermissionManager)
        testWindow = UIWindow(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
                let testViewController = UIViewController()
                testViewController.view.backgroundColor = .white
                testWindow.rootViewController = testViewController
                testWindow.makeKeyAndVisible()
    }

    override func tearDown() {
        snapshotGenerator = nil
        testWindow = nil
        userPermissionManager = nil
        super.tearDown()
    }

    func testPerformanceOfScreenshotGeneration() {
        // Add 1000 views to the view hierarchy
        let containerView = testWindow.rootViewController!.view!

        for i in 0..<1000 { // swiftlint:disable:this identifier_name
            let view = UIView(frame: CGRect(x: 10, y: i * 5, width: 50, height: 50))
            view.backgroundColor = .gray
            view.accessibilityIdentifier = "testView_\(i)" // For debugging if needed
            containerView.addSubview(view)
        }

        testWindow.layoutIfNeeded()

        measure {
            // Generate a screenshot using the last view's position as the touch point
            _ = screenshotGenerator.generate(window: testWindow, name: "test_screenshot", storageType: .data)
        }
    }
}
