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
                            bugReportConfig: BugReportConfig,
                            attributes: [String: AttributeValue]?)
    func validateBugReport(attachments: Int,
                           descriptionLength: Int) -> Bool
    func trackBugReport(description: String,
                        attachments: [Attachment],
                        attributes: [String: AttributeValue]?)
}

final class BaseBugReportCollector: BugReportCollector {
    private let bugReportManager: BugReportManager
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private var userDefinedAttributes: [String: AttributeValue]?
    private let sessionManager: SessionManager
    private let idProvider: IdProvider

    init(bugReportManager: BugReportManager,
         signalProcessor: SignalProcessor,
         timeProvider: TimeProvider,
         sessionManager: SessionManager,
         idProvider: IdProvider) {
        self.bugReportManager = bugReportManager
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.sessionManager = sessionManager
        self.idProvider = idProvider
        self.bugReportManager.setBugReportCollector(self)
    }

    func startBugReportFlow(takeScreenshot: Bool,
                            bugReportConfig: BugReportConfig,
                            attributes: [String: AttributeValue]?) {
        self.userDefinedAttributes = attributes
        bugReportManager.setBugReportConfig(bugReportConfig)
        bugReportManager.openBugReporter([], takeScreenshot: takeScreenshot)
    }

    func validateBugReport(attachments: Int, descriptionLength: Int) -> Bool {
        return attachments > 0 || descriptionLength > 0
    }

    func trackBugReport(description: String,
                        attachments: [Attachment],
                        attributes: [String: AttributeValue]?) {
        signalProcessor.trackUserTriggered(data: BugReportData(description: description),
                                           timestamp: timeProvider.now(),
                                           type: .bugReport,
                                           attributes: nil,
                                           sessionId: nil,
                                           attachments: attachments,
                                           userDefinedAttributes: EventSerializer.serializeUserDefinedAttribute(userDefinedAttributes),
                                           threadName: nil)
        sessionManager.markCurrentSessionAsCrashed()
    }
}
