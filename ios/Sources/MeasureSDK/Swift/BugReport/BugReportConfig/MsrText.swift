//
//  MsrText.swift
//  Measure
//
//  Created by Adwin Ross on 26/05/25.
//

import Foundation

/// `MsrText` encapsulates all user-facing strings used in the bug reporting UI.
public class MsrText: NSObject {
    /// The title displayed at the top of the bug report screen.
    public let reportBugTitle: String

    /// Placeholder text shown in the bug description input field.
    public let descriptionPlaceholder: String

    /// Label text for the `Send` button that submits the bug report.
    public let sendButton: String

    /// Label text for the button used to take a screenshot.
    public let screenshotButton: String

    /// Label text for the button used to pick an image from the gallery.
    public let galleryButton: String

    /// Instructional text shown to exit screenshot annotation mode.
    public let exitScreenshotMode: String

    public init(reportBugTitle: String, descriptionPlaceholder: String, sendButton: String, screenshotButton: String, galleryButton: String, exitScreenshotMode: String) {
        self.reportBugTitle = reportBugTitle
        self.descriptionPlaceholder = descriptionPlaceholder
        self.sendButton = sendButton
        self.screenshotButton = screenshotButton
        self.galleryButton = galleryButton
        self.exitScreenshotMode = exitScreenshotMode
    }

    public func update(
        reportBugTitle: String? = nil,
        descriptionPlaceholder: String? = nil,
        sendButton: String? = nil,
        screenshotButton: String? = nil,
        galleryButton: String? = nil,
        exitScreenshotMode: String? = nil
    ) -> MsrText {
        return MsrText(
            reportBugTitle: reportBugTitle ?? self.reportBugTitle,
            descriptionPlaceholder: descriptionPlaceholder ?? self.descriptionPlaceholder,
            sendButton: sendButton ?? self.sendButton,
            screenshotButton: screenshotButton ?? self.screenshotButton,
            galleryButton: galleryButton ?? self.galleryButton,
            exitScreenshotMode: exitScreenshotMode ?? self.exitScreenshotMode
        )
    }
}
