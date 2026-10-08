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
    private let configProvider: ConfigProvider
    private let attributeValueValidator: AttributeValueValidator

    init(bugReportManager: BugReportManager,
         signalProcessor: SignalProcessor,
         timeProvider: TimeProvider,
         sessionManager: SessionManager,
         idProvider: IdProvider,
         logger: Logger,
         configProvider: ConfigProvider,
         attributeValueValidator: AttributeValueValidator) {
        self.bugReportManager = bugReportManager
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.sessionManager = sessionManager
        self.idProvider = idProvider
        self.logger = logger
        self.configProvider = configProvider
        self.attributeValueValidator = attributeValueValidator
        self.bugReportManager.setBugReportCollector(self)
    }

    func startBugReportFlow(takeScreenshot: Bool,
                            bugReportConfig: BugReportConfig,
                            attributes: [String: AttributeValue]?) {
        logger.log(level: .info, message: "BugReportCollector: Bug Report Flow Started", error: nil, data: nil)
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
            let validAttributes = attributeValueValidator.dropInvalidAttributes(name: "bug_report", attributes: attributes)
            signalProcessor.trackUserTriggered(data: BugReportData(description: sanitizedDescription(description)),
                                               timestamp: timeProvider.now(),
                                               type: .bugReport,
                                               attributes: nil,
                                               sessionId: nil,
                                               attachments: sanitizedAttachments(attachments),
                                               userDefinedAttributes: EventSerializer.serializeUserDefinedAttribute(validAttributes),
                                               threadName: nil,
                                               needsReporting: true)
            sessionManager.markCurrentSessionAsCrashed()
        }
    }

    private func sanitizedDescription(_ description: String) -> String {
        let maxLength = Int(configProvider.maxDescriptionLengthInBugReport)
        if description.count > maxLength {
            logger.log(level: .warning,
                       message: "BugReportCollector: Description exceeds the maximum length of \(maxLength) characters and will be truncated",
                       error: nil,
                       data: nil)
        }
        return description.truncated(maxLength: maxLength)
    }

    private func sanitizedAttachments(_ attachments: [MsrAttachment]) -> [MsrAttachment] {
        let maxAttachments = Int(configProvider.maxAttachmentsInBugReport)
        if attachments.count > maxAttachments {
            logger.log(level: .warning,
                       message: "BugReportCollector: Bug report has more than \(maxAttachments) attachments, extra attachments will be dropped",
                       error: nil,
                       data: nil)
        }
        return attachments.prefix(maxAttachments).map { attachment in
            guard attachment.name.isEmpty else { return attachment }
            return MsrAttachment(name: attachment.id,
                                 type: attachment.type,
                                 size: attachment.size,
                                 id: attachment.id,
                                 bytes: attachment.bytes,
                                 path: attachment.path)
        }
    }
}
