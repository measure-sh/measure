//
//  BugReportManager.swift
//  Measure
//
//  Created by Adwin Ross on 05/05/25.
//

import Foundation
import UIKit

protocol BugReportManager {
    func setBugReportConfig(_ bugReportConfig: BugReportConfig)
    func openBugReporter(attachments: [Attachment])
    func setBugReportCollector(_ collector: BaseBugReportCollector)
}

final class BaseBugReportManager: BugReportManager {
    private var bugReportingViewController: BugReportingViewController?
    private var floatingButtonViewController: FloatingButtonViewController?
    private let screenshotGenerator: ScreenshotGenerator
    private var localAttachments: [Attachment] = []
    private var isBugReporterOpen: Bool = false
    private let configProvider: ConfigProvider
    private let idProvider: IdProvider
    private var bugReportConfig: BugReportConfig?
    private weak var bugReportCollector: BaseBugReportCollector?

    init(screenshotGenerator: ScreenshotGenerator, configProvider: ConfigProvider, idProvider: IdProvider) {
        self.screenshotGenerator = screenshotGenerator
        self.configProvider = configProvider
        self.idProvider = idProvider
    }

    func setBugReportCollector(_ collector: BaseBugReportCollector) {
        self.bugReportCollector = collector
    }

    func setBugReportConfig(_ bugReportConfig: BugReportConfig) {
        self.bugReportConfig = bugReportConfig
    }

    func openBugReporter(attachments: [Attachment]) {
        if self.bugReportingViewController != nil || self.isBugReporterOpen {
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.openBugReportViewController()
        }
    }

    private func openBugReportViewController() {
        let bugVC = BugReportingViewController(attachments: self.localAttachments, configProvider: configProvider, bugReportConfig: bugReportConfig ?? BugReportConfig.default, idProvider: idProvider)
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

extension BaseBugReportManager: BugReportingViewControllerDelegate {
    func bugReportingViewControllerDidDismiss(_ description: String?, attachments: [Attachment]?) {
        self.bugReportingViewController = nil
        self.isBugReporterOpen = false
        if let description = description, let attachments = attachments {
            bugReportCollector?.trackBugReport(description: description, attachments: attachments, attributes: nil)
        }
    }

    func bugReportingViewControllerDidRequestScreenshot(_ attachments: [Attachment]) {
        self.bugReportingViewController = nil
        self.isBugReporterOpen = false
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.localAttachments = attachments

            // Create and show the floating button controller
            self.floatingButtonViewController = FloatingButtonViewController(screenshotGenerator: self.screenshotGenerator, bugReportConfig: bugReportConfig ?? BugReportConfig.default, attachments: self.localAttachments, configProvider: configProvider)
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
    func floatingButtonViewControllerDismissed(_ attachments: [Attachment]) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.localAttachments = attachments
            self.openBugReporter(attachments: attachments)
        }
    }
}
