//
//  LayoutSnapshotGeneratorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 03/02/25.
//

import XCTest
@testable import Measure

final class BaseLayoutSnapshotGeneratorTests: XCTestCase {
    private var logger: MockLogger!
    private var configProvider: MockConfigProvider!
    private var timeProvider: MockTimeProvider!
    private var snapshotGenerator: BaseLayoutSnapshotGenerator!
    private var attachmentProcessor: MockAttachmentProcessor!
    private var svgGenerator: MockSvgGenerator!
    private var testWindow: UIWindow!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        configProvider = MockConfigProvider()
        timeProvider = MockTimeProvider()
        attachmentProcessor = MockAttachmentProcessor()
        svgGenerator = MockSvgGenerator()
        snapshotGenerator = BaseLayoutSnapshotGenerator(logger: logger,
                                                        configProvider: configProvider,
                                                        timeProvider: timeProvider,
                                                        attachmentProcessor: attachmentProcessor,
                                                        svgGenerator: svgGenerator)
        testWindow = UIWindow(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
                let testViewController = UIViewController()
                testViewController.view.backgroundColor = .white
                testWindow.rootViewController = testViewController
                testWindow.makeKeyAndVisible()
    }

    override func tearDown() {
        snapshotGenerator = nil
        testWindow = nil
        attachmentProcessor = nil
        timeProvider = nil
        configProvider = nil
        super.tearDown()
    }

    func testPerformanceOfGenerate() {
        let containerView = testWindow.rootViewController!.view!

        for i in 0..<1000 { // swiftlint:disable:this identifier_name
            let view = UIView(frame: CGRect(x: 10, y: i * 5, width: 50, height: 50))
            view.backgroundColor = .gray
            view.accessibilityIdentifier = "testView_\(i)"
            containerView.addSubview(view)
        }

        // Ensure layout is updated before testing
        testWindow.layoutIfNeeded()

        // Get the last view's position
        let lastView = containerView.subviews.last!
        let lastViewCenter = lastView.center

        measure {
            _ = snapshotGenerator.generate(window: testWindow, touchPoint: lastViewCenter)
        }
    }
}
