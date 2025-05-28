//
//  MockBugReportManager.swift
//  Measure
//
//  Created by Adwin Ross on 22/05/25.
//

import Foundation
@testable import Measure

final class MockBugReportManager: BugReportManager {
    var didSetBugReportConfig = false
    var didOpenBugReporter = false
    var didSetBugReportCollector = false

    var receivedConfig: BugReportConfig?
    var receivedAttachments: [Attachment] = []
    var receivedTakeScreenshot: Bool?
    var receivedCollector: BaseBugReportCollector?

    func setBugReportConfig(_ bugReportConfig: BugReportConfig) {
        didSetBugReportConfig = true
        receivedConfig = bugReportConfig
    }

    func openBugReporter(_ attachments: [Attachment], takeScreenshot: Bool) {
        didOpenBugReporter = true
        receivedAttachments = attachments
        receivedTakeScreenshot = takeScreenshot
    }

    func setBugReportCollector(_ collector: BaseBugReportCollector) {
        didSetBugReportCollector = true
        receivedCollector = collector
    }
}
