//
//  BugReportCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/05/25.
//

import XCTest
@testable import Measure

final class BaseBugReportCollectorTests: XCTestCase {

    func test_startBugReportFlow_setsConfigAndCallsOpen() {
        let bugReportManager = MockBugReportManager()
        let signalProcessor = MockSignalProcessor()
        let timeProvider = MockTimeProvider()
        let sessionManager = MockSessionManager()
        let idProvider = MockIdProvider()

        let collector = BaseBugReportCollector(
            bugReportManager: bugReportManager,
            signalProcessor: signalProcessor,
            timeProvider: timeProvider,
            sessionManager: sessionManager,
            idProvider: idProvider
        )

        let config = BugReportConfig.default
        let attributes: [String: AttributeValue] = ["userType": .string("tester")]

        collector.startBugReportFlow(takeScreenshot: true,
                                     bugReportConfig: config,
                                     attributes: attributes)

        XCTAssertTrue(bugReportManager.didSetBugReportConfig)
        XCTAssertTrue(bugReportManager.didOpenBugReporter)
        XCTAssertEqual(bugReportManager.receivedTakeScreenshot, true)
        XCTAssertTrue(bugReportManager.didSetBugReportCollector)
        XCTAssertTrue(bugReportManager.receivedCollector === collector)
    }

    func test_validateBugReport_logic() {
        let collector = BaseBugReportCollector(
            bugReportManager: MockBugReportManager(),
            signalProcessor: MockSignalProcessor(),
            timeProvider: MockTimeProvider(),
            sessionManager: MockSessionManager(),
            idProvider: MockIdProvider()
        )

        XCTAssertTrue(collector.validateBugReport(attachments: 1, descriptionLength: 0))
        XCTAssertTrue(collector.validateBugReport(attachments: 0, descriptionLength: 1))
        XCTAssertTrue(collector.validateBugReport(attachments: 1, descriptionLength: 1))
        XCTAssertFalse(collector.validateBugReport(attachments: 0, descriptionLength: 0))
    }

    func test_trackBugReport_sendsCorrectSignalAndMarksSessionCrashed() {
        let bugReportManager = MockBugReportManager()
        let signalProcessor = MockSignalProcessor()
        let timeProvider = MockTimeProvider()
        timeProvider.current = 12345
        let sessionManager = MockSessionManager()
        let idProvider = MockIdProvider()

        let collector = BaseBugReportCollector(
            bugReportManager: bugReportManager,
            signalProcessor: signalProcessor,
            timeProvider: timeProvider,
            sessionManager: sessionManager,
            idProvider: idProvider
        )

        let attachments = [Attachment(name: "screenshot.png", type: .screenshot, size: 123, id: "attachmentId", bytes: Data("log".utf8), path: nil)]
        let attributes: [String: AttributeValue] = ["key": .string("value")]

        collector.startBugReportFlow(takeScreenshot: false,
                                     bugReportConfig: .default,
                                     attributes: attributes)

        collector.trackBugReport(description: "App crashed", attachments: attachments, attributes: attributes)

        guard let data = signalProcessor.data as? BugReportData else {
            XCTFail("Data not Tracked.")
            return
        }

        XCTAssertEqual(data.description, "App crashed")
        XCTAssertEqual(signalProcessor.attachments, attachments)
        XCTAssertTrue(((signalProcessor.userDefinedAttributes?.contains("key:value")) != nil))
        XCTAssertTrue(sessionManager.isCrashed)
    }
}
