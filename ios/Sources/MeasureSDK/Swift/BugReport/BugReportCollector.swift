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
                        attachments: [MsrAttachment],
                        attributes: [String: AttributeValue]?)
}

final class BaseBugReportCollector: BugReportCollector {
    private let bugReportManager: BugReportManager
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private var userDefinedAttributes: [String: AttributeValue]?
    private let sessionManager: SessionManager
    private let idProvider: IdProvider
    private let logger: Logger

    init(bugReportManager: BugReportManager,
         signalProcessor: SignalProcessor,
         timeProvider: TimeProvider,
         sessionManager: SessionManager,
         idProvider: IdProvider,
         logger: Logger) {
        self.bugReportManager = bugReportManager
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.sessionManager = sessionManager
        self.idProvider = idProvider
        self.logger = logger
        self.bugReportManager.setBugReportCollector(self)
    }

    func startBugReportFlow(takeScreenshot: Bool,
                            bugReportConfig: BugReportConfig,
                            attributes: [String: AttributeValue]?) {
        logger.log(level: .info, message: "Bug Report Flow Started", error: nil, data: nil)
        self.userDefinedAttributes = attributes
        bugReportManager.setBugReportConfig(bugReportConfig)
        bugReportManager.openBugReporter([], takeScreenshot: takeScreenshot)
    }

    func validateBugReport(attachments: Int, descriptionLength: Int) -> Bool {
        return attachments > 0 || descriptionLength > 0
    }

    func trackBugReport(description: String,
                        attachments: [MsrAttachment],
                        attributes: [String: AttributeValue]?) {
        SignPost.trace(subcategory: "Event", label: "trackBugReport") {
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
}
