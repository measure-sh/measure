//
//  BugReportCollector.swift
//  Measure
//
//  Created by Adwin Ross on 08/05/25.
//

import Foundation
import UIKit

protocol BugReportCollector {
    func startBugReportFlow(takeScreenshot: Bool,
                            attributes: [String: AttributeValue]?)

    func validateBugReport(attachmentsCount: Int, descriptionLength: Int) -> Bool
}

final class BaseBugReportCollector: BugReportCollector {
    private let bugReportManager: BugReportManager
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private var userDefinedAttributes: [String: AttributeValue]?

    init(bugReportManager: BugReportManager, signalProcessor: SignalProcessor, timeProvider: TimeProvider) {
        self.bugReportManager = bugReportManager
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.bugReportManager.setBugReportCollector(self)
    }

    func startBugReportFlow(takeScreenshot: Bool,
                            attributes: [String: AttributeValue]?) {
        self.userDefinedAttributes = attributes
        bugReportManager.openBugReporter(attachments: [])
    }

    func validateBugReport(attachmentsCount: Int, descriptionLength: Int) -> Bool {
        return true
    }

    func trackBugReport(_ description: String, attachments: [Attachment]) {
        signalProcessor.trackUserTriggered(data: BugReportData(description: description),
                                           timestamp: timeProvider.now(),
                                           type: .bugReport,
                                           attributes: nil,
                                           sessionId: nil,
                                           attachments: attachments,
                                           userDefinedAttributes: EventSerializer.serializeUserDefinedAttribute(userDefinedAttributes),
                                           threadName: nil)
    }
}
