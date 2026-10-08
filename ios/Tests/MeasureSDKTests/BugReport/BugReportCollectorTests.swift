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
            idProvider: idProvider,
            logger: MockLogger(),
            configProvider: MockConfigProvider(),
            attributeValueValidator: BaseAttributeValueValidator(configProvider: MockConfigProvider(), logger: MockLogger())
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
            idProvider: MockIdProvider(),
            logger: MockLogger(),
            configProvider: MockConfigProvider(),
            attributeValueValidator: BaseAttributeValueValidator(configProvider: MockConfigProvider(), logger: MockLogger())
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
            idProvider: idProvider,
            logger: MockLogger(),
            configProvider: MockConfigProvider(),
            attributeValueValidator: BaseAttributeValueValidator(configProvider: MockConfigProvider(), logger: MockLogger())
        )

        let attachments = [MsrAttachment(name: "screenshot.png", type: .screenshot, size: 123, id: "attachmentId", bytes: Data("log".utf8), path: nil)]
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

    private func makeCollector(signalProcessor: MockSignalProcessor) -> BaseBugReportCollector {
        let configProvider = MockConfigProvider()
        return BaseBugReportCollector(
            bugReportManager: MockBugReportManager(),
            signalProcessor: signalProcessor,
            timeProvider: MockTimeProvider(),
            sessionManager: MockSessionManager(),
            idProvider: MockIdProvider(),
            logger: MockLogger(),
            configProvider: configProvider,
            attributeValueValidator: BaseAttributeValueValidator(configProvider: configProvider, logger: MockLogger())
        )
    }

    private func makeAttachment(name: String, id: String) -> MsrAttachment {
        return MsrAttachment(name: name, type: .screenshot, size: 3, id: id, bytes: Data("png".utf8), path: nil)
    }

    func test_trackBugReport_truncatesDescription_whenLongerThanMaxLength() {
        let signalProcessor = MockSignalProcessor()
        let collector = makeCollector(signalProcessor: signalProcessor)
        let maxLength = Int(MockConfigProvider().maxDescriptionLengthInBugReport)

        collector.trackBugReport(description: String(repeating: "d", count: maxLength + 1), attachments: [], attributes: nil)

        XCTAssertEqual((signalProcessor.data as? BugReportData)?.description.count, maxLength)
    }

    func test_trackBugReport_keepsMaxAttachments_whenMoreAreProvided() {
        let signalProcessor = MockSignalProcessor()
        let collector = makeCollector(signalProcessor: signalProcessor)
        let maxAttachments = Int(MockConfigProvider().maxAttachmentsInBugReport)
        let attachments = (0...maxAttachments).map { makeAttachment(name: "screenshot_\($0).png", id: "id_\($0)") }

        collector.trackBugReport(description: "bug", attachments: attachments, attributes: nil)

        XCTAssertEqual(signalProcessor.attachments?.count, maxAttachments)
        XCTAssertEqual(signalProcessor.attachments?.first?.id, "id_0")
    }

    func test_trackBugReport_namesAttachmentAfterId_whenNameIsEmpty() {
        let signalProcessor = MockSignalProcessor()
        let collector = makeCollector(signalProcessor: signalProcessor)

        collector.trackBugReport(description: "bug", attachments: [makeAttachment(name: "", id: "attachment-id")], attributes: nil)

        XCTAssertEqual(signalProcessor.attachments?.first?.name, "attachment-id")
        XCTAssertEqual(signalProcessor.attachments?.first?.id, "attachment-id")
    }

    func test_trackBugReport_dropsInvalidAttributes_andKeepsValidOnes() {
        let signalProcessor = MockSignalProcessor()
        let collector = makeCollector(signalProcessor: signalProcessor)

        collector.trackBugReport(description: "bug",
                                 attachments: [],
                                 attributes: ["a.b": .string("invalid"), "valid_key": .string("valid")])

        XCTAssertNotNil(signalProcessor.data as? BugReportData)
        XCTAssertTrue(signalProcessor.userDefinedAttributes?.contains("valid_key") == true)
        XCTAssertFalse(signalProcessor.userDefinedAttributes?.contains("a.b") == true)
    }
}
