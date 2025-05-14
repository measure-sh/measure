//
//  BugReportConfig.swift
//  Measure
//
//  Created by Adwin Ross on 13/05/25.
//

import Foundation
import UIKit

public struct BugReportConfig {
    // MARK: - Colors
    public struct Colors {
        public let darkBackground: UIColor
        public let lightBackground: UIColor
        public let darkButtonBackground: UIColor
        public let lightButtonBackground: UIColor
        public let darkText: UIColor
        public let lightText: UIColor
        public let darkPlaceholder: UIColor
        public let lightPlaceholder: UIColor
        public let darkFloatingButtonBackground: UIColor
        public let lightFloatingButtonBackground: UIColor
        public let darkFloatingButtonIcon: UIColor
        public let lightFloatingButtonIcon: UIColor
        public let darkfloatingExitButtonText: UIColor
        public let lightfloatingExitButtonText: UIColor
        public let badgeColor: UIColor
        public let badgeTextColor: UIColor

        public var background: UIColor {
            isDarkMode ? darkBackground : lightBackground
        }

        public var buttonBackground: UIColor {
            isDarkMode ? darkButtonBackground : lightButtonBackground
        }

        public var text: UIColor {
            isDarkMode ? darkText : lightText
        }

        public var placeholder: UIColor {
            isDarkMode ? darkPlaceholder : lightPlaceholder
        }

        public var floatingButtonBackground: UIColor {
            isDarkMode ? darkFloatingButtonBackground : lightFloatingButtonBackground
        }

        public var floatingButtonIcon: UIColor {
            isDarkMode ? darkFloatingButtonIcon : lightFloatingButtonIcon
        }

        public var floatingExitButtonText: UIColor {
            isDarkMode ? darkfloatingExitButtonText : lightfloatingExitButtonText
        }

        public let isDarkMode: Bool

        public init(
            darkBackground: UIColor,
            lightBackground: UIColor,
            darkButtonBackground: UIColor,
            lightButtonBackground: UIColor,
            darkText: UIColor,
            lightText: UIColor,
            darkPlaceholder: UIColor,
            lightPlaceholder: UIColor,
            darkFloatingButtonBackground: UIColor,
            lightFloatingButtonBackground: UIColor,
            darkFloatingButtonIcon: UIColor,
            lightFloatingButtonIcon: UIColor,
            darkfloatingExitButtonText: UIColor,
            lightfloatingExitButtonText: UIColor,
            badgeColor: UIColor,
            badgeTextColor: UIColor,
            isDarkMode: Bool
        ) {
            self.darkBackground = darkBackground
            self.lightBackground = lightBackground
            self.darkButtonBackground = darkButtonBackground
            self.lightButtonBackground = lightButtonBackground
            self.darkText = darkText
            self.lightText = lightText
            self.darkPlaceholder = darkPlaceholder
            self.lightPlaceholder = lightPlaceholder
            self.darkFloatingButtonBackground = darkFloatingButtonBackground
            self.lightFloatingButtonBackground = lightFloatingButtonBackground
            self.darkFloatingButtonIcon = darkFloatingButtonIcon
            self.lightFloatingButtonIcon = lightFloatingButtonIcon
            self.darkfloatingExitButtonText = darkfloatingExitButtonText
            self.lightfloatingExitButtonText = lightfloatingExitButtonText
            self.badgeColor = badgeColor
            self.badgeTextColor = badgeTextColor
            self.isDarkMode = isDarkMode
        }

        public func update(
            darkBackground: UIColor? = nil,
            lightBackground: UIColor? = nil,
            darkButtonBackground: UIColor? = nil,
            lightButtonBackground: UIColor? = nil,
            darkText: UIColor? = nil,
            lightText: UIColor? = nil,
            darkPlaceholder: UIColor? = nil,
            lightPlaceholder: UIColor? = nil,
            darkFloatingButtonBackground: UIColor? = nil,
            lightFloatingButtonBackground: UIColor? = nil,
            darkFloatingButtonIcon: UIColor? = nil,
            lightFloatingButtonIcon: UIColor? = nil,
            darkfloatingExitButtonText: UIColor? = nil,
            lightfloatingExitButtonText: UIColor? = nil,
            badgeColor: UIColor? = nil,
            badgeTextColor: UIColor? = nil,
            isDarkMode: Bool? = nil
        ) -> Colors {
            return Colors(
                darkBackground: darkBackground ?? self.darkBackground,
                lightBackground: lightBackground ?? self.lightBackground,
                darkButtonBackground: darkButtonBackground ?? self.darkButtonBackground,
                lightButtonBackground: lightButtonBackground ?? self.lightButtonBackground,
                darkText: darkText ?? self.darkText,
                lightText: lightText ?? self.lightText,
                darkPlaceholder: darkPlaceholder ?? self.darkPlaceholder,
                lightPlaceholder: lightPlaceholder ?? self.lightPlaceholder,
                darkFloatingButtonBackground: darkFloatingButtonBackground ?? self.darkFloatingButtonBackground,
                lightFloatingButtonBackground: lightFloatingButtonBackground ?? self.lightFloatingButtonBackground,
                darkFloatingButtonIcon: darkFloatingButtonIcon ?? self.darkFloatingButtonIcon,
                lightFloatingButtonIcon: lightFloatingButtonIcon ?? self.lightFloatingButtonIcon,
                darkfloatingExitButtonText: darkfloatingExitButtonText ?? self.darkfloatingExitButtonText,
                lightfloatingExitButtonText: lightfloatingExitButtonText ?? self.lightfloatingExitButtonText,
                badgeColor: badgeColor ?? self.badgeColor,
                badgeTextColor: badgeTextColor ?? self.badgeTextColor,
                isDarkMode: isDarkMode ?? self.isDarkMode
            )
        }
    }

    // MARK: - Text
    public struct Text {
        public let reportBugTitle: String
        public let descriptionPlaceholder: String
        public let sendButton: String
        public let screenshotButton: String
        public let uploadButton: String
        public let exitScreenshotMode: String

        public init(reportBugTitle: String, descriptionPlaceholder: String, sendButton: String, screenshotButton: String, uploadButton: String, exitScreenshotMode: String) {
            self.reportBugTitle = reportBugTitle
            self.descriptionPlaceholder = descriptionPlaceholder
            self.sendButton = sendButton
            self.screenshotButton = screenshotButton
            self.uploadButton = uploadButton
            self.exitScreenshotMode = exitScreenshotMode
        }

        public func update(
            reportBugTitle: String? = nil,
            descriptionPlaceholder: String? = nil,
            sendButton: String? = nil,
            screenshotButton: String? = nil,
            uploadButton: String? = nil,
            exitScreenshotMode: String? = nil
        ) -> Text {
            return Text(
                reportBugTitle: reportBugTitle ?? self.reportBugTitle,
                descriptionPlaceholder: descriptionPlaceholder ?? self.descriptionPlaceholder,
                sendButton: sendButton ?? self.sendButton,
                screenshotButton: screenshotButton ?? self.screenshotButton,
                uploadButton: uploadButton ?? self.uploadButton,
                exitScreenshotMode: exitScreenshotMode ?? self.exitScreenshotMode
            )
        }
    }

    // MARK: - Dimensions
    public struct Dimensions {
        public let topPadding: CGFloat

        public init(topPadding: CGFloat) {
            self.topPadding = topPadding
        }

        public func update(topPadding: CGFloat? = nil) -> Dimensions {
            return Dimensions(topPadding: topPadding ?? self.topPadding)
        }
    }

    // MARK: - Fonts
    public struct Fonts {
        public let title: UIFont
        public let button: UIFont
        public let description: UIFont

        public init(title: UIFont, button: UIFont, description: UIFont) {
            self.title = title
            self.button = button
            self.description = description
        }

        public func update(
            title: UIFont? = nil,
            button: UIFont? = nil,
            description: UIFont? = nil
        ) -> Fonts {
            return Fonts(
                title: title ?? self.title,
                button: button ?? self.button,
                description: description ?? self.description
            )
        }
    }

    public let colors: Colors
    public let text: Text
    public let dimensions: Dimensions
    public let fonts: Fonts

    public init(colors: Colors = BugReportConfig.default.colors, text: Text = BugReportConfig.default.text, dimensions: Dimensions = BugReportConfig.default.dimensions, fonts: Fonts = BugReportConfig.default.fonts) {
        self.colors = colors
        self.text = text
        self.dimensions = dimensions
        self.fonts = fonts
    }

    public static let `default` = BugReportConfig(
        colors: Colors(
            darkBackground: UIColor(white: 0.15, alpha: 1),
            lightBackground: .white,
            darkButtonBackground: UIColor(white: 0.2, alpha: 1),
            lightButtonBackground: UIColor(white: 0.95, alpha: 1),
            darkText: .white,
            lightText: .black,
            darkPlaceholder: .gray,
            lightPlaceholder: .lightGray,
            darkFloatingButtonBackground: .systemBlue,
            lightFloatingButtonBackground: .systemBlue,
            darkFloatingButtonIcon: .white,
            lightFloatingButtonIcon: .white,
            darkfloatingExitButtonText: .white,
            lightfloatingExitButtonText: .white,
            badgeColor: .systemRed,
            badgeTextColor: .white,
            isDarkMode: true
        ),
        text: Text(
            reportBugTitle: "Report a bug",
            descriptionPlaceholder: "Briefly describe the issue you are facing.",
            sendButton: "Send",
            screenshotButton: "Screenshot",
            uploadButton: "Upload",
            exitScreenshotMode: "Tap to exit Screenshot mode"
        ),
        dimensions: Dimensions(
            topPadding: 20
        ),
        fonts: Fonts(
            title: UIFont.boldSystemFont(ofSize: 18),
            button: UIFont.systemFont(ofSize: 14, weight: .semibold),
            description: UIFont.systemFont(ofSize: 16)
        )
    )
}
