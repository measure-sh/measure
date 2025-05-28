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
    func openBugReporter(_ attachments: [Attachment], takeScreenshot: Bool)
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
    private var hasBugReportFlowStarted = false
    private var description: String?

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

    func openBugReporter(_ attachments: [Attachment], takeScreenshot: Bool) {
        if self.bugReportingViewController != nil || self.isBugReporterOpen || self.hasBugReportFlowStarted {
            return
        }
        self.hasBugReportFlowStarted = true
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if takeScreenshot,
               let window = UIWindow.keyWindow(),
               let attachment = screenshotGenerator.generate(window: window, name: screenshotName, storageType: .data) {
                localAttachments.append(attachment)
            }
            self.openBugReportViewController()
        }
    }

    private func openBugReportViewController() {
        let bugVC = BugReportingViewController(description: description,
                                               attachments: self.localAttachments,
                                               configProvider: configProvider,
                                               bugReportConfig: bugReportConfig ?? BugReportConfig.default,
                                               idProvider: idProvider)
        bugVC.modalPresentationStyle = .fullScreen
        bugVC.delegate = self
        self.bugReportingViewController = bugVC
        if let root = UIWindow.keyWindow()?.rootViewController {
            var top = root
            while let presented = top.presentedViewController {
                top = presented
            }
            top.present(bugVC, animated: true) {
                self.isBugReporterOpen = true
            }
        }
    }

    private func clearState() {
        self.localAttachments.removeAll()
        self.description = nil
        self.hasBugReportFlowStarted = false
    }
}

extension BaseBugReportManager: BugReportingViewControllerDelegate {
    func bugReportingViewControllerDidDismiss(_ description: String?, attachments: [Attachment]?) {
        self.bugReportingViewController = nil
        self.isBugReporterOpen = false
        if let description = description, let attachments = attachments {
            bugReportCollector?.trackBugReport(description: description, attachments: attachments, attributes: nil)
        }
        clearState()
    }

    func bugReportingViewControllerDidRequestScreenshot(_ description: String?, attachments: [Attachment]) {
        self.bugReportingViewController = nil
        self.isBugReporterOpen = false
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.localAttachments = attachments
            self.description = description

            self.floatingButtonViewController = FloatingButtonViewController(screenshotGenerator: self.screenshotGenerator,
                                                                             bugReportConfig: bugReportConfig ?? BugReportConfig.default,
                                                                             attachments: self.localAttachments,
                                                                             configProvider: configProvider)
            self.floatingButtonViewController?.delegate = self

            if let window = UIWindow.keyWindow() {
                self.floatingButtonViewController?.view.frame = window.bounds
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
            self.openBugReportViewController()
        }
    }
}
