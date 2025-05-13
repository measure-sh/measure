//
//  BugReportManager.swift
//  Measure
//
//  Created by Adwin Ross on 05/05/25.
//

import Foundation
import UIKit

protocol BugReportManager {
    func openBugReporter(attachments: [MsrAttachment])
    func setBugReportCollector(_ collector: BaseBugReportCollector)
}

final class BaseBugReportManager: BugReportManager {
    private var bugReportingViewController: BugReportingViewController?
    private var floatingButtonViewController: FloatingButtonViewController?
    private let screenshotGenerator: ScreenshotGenerator
    private var localAttachments: [MsrAttachment] = []
    private var isBugReporterOpen: Bool = false
    private let configProvider: ConfigProvider
    private weak var bugReportCollector: BaseBugReportCollector?

    init(screenshotGenerator: ScreenshotGenerator, configProvider: ConfigProvider) {
        self.screenshotGenerator = screenshotGenerator
        self.configProvider = configProvider
    }

    func setBugReportCollector(_ collector: BaseBugReportCollector) {
        self.bugReportCollector = collector
    }

    func openBugReporter(attachments: [MsrAttachment]) {
        if self.bugReportingViewController != nil || self.isBugReporterOpen {
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            localAttachments.append(contentsOf: attachments)
            let bugVC = BugReportingViewController(attachments: self.localAttachments, configProvider: configProvider)
            bugVC.modalPresentationStyle = .fullScreen
            bugVC.delegate = self
            self.bugReportingViewController = bugVC
            if let root = UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController {
                var top = root
                while let presented = top.presentedViewController {
                    top = presented
                }
                top.present(bugVC, animated: true) {
                    self.isBugReporterOpen = true
                }
            }
        }
    }
}

extension BaseBugReportManager: BugReportingViewControllerDelegate {
    func bugReportingViewControllerDidDismiss(_ description: String?, attachments: [MsrAttachment]?) {
        self.bugReportingViewController = nil
        self.isBugReporterOpen = false
        if let description = description, let attachments = attachments {
            bugReportCollector?.trackBugReport(description: description, attachments: attachments, attributes: nil)
        }
    }

    func bugReportingViewControllerDidRequestScreenshot(_ attachments: [MsrAttachment]) {
        self.bugReportingViewController = nil
        self.isBugReporterOpen = false
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.localAttachments = attachments

            // Create and show the floating button controller
            self.floatingButtonViewController = FloatingButtonViewController(screenshotGenerator: self.screenshotGenerator)
            self.floatingButtonViewController?.delegate = self

            // Get the key window
            if let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) {
                // Set the frame to match the window bounds
                self.floatingButtonViewController?.view.frame = window.bounds
                // Add the view to the window
                window.addSubview(self.floatingButtonViewController!.view)
            }
        }
    }
}

extension BaseBugReportManager: FloatingButtonViewControllerDelegate {
    func floatingButtonViewController(_ attachment: Attachment) {
        // Convert the attachment to UIImage and add it to the bug reporter
        if let bytes = attachment.bytes {
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                let attachment = MsrAttachment(name: attachment.name, bytes: bytes, type: attachment.type)
                self.openBugReporter(attachments: [attachment])
                self.bugReportingViewController?.addAttachment(attachment)
            }
        }
    }

    func floatingButtonViewControllerDismissed() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.openBugReporter(attachments: [])
        }
    }
}
