//
//  BugReportConfig.swift
//  Measure
//
//  Created by Adwin Ross on 13/05/25.
//

import Foundation
import UIKit

/// A configuration object used to customize the appearance and behavior of the bug report UI.
@objc public class BugReportConfig: NSObject {
    /// The color palette used for styling various bug report UI elements.
    public let colors: MsrColors

    /// The text content used throughout the bug report interface.
    public let text: MsrText

    /// The layout dimensions for components in the bug report screen.
    public let dimensions: MsrDimensions

    /// The font styles applied to the bug report UI components.
    public let fonts: MsrFonts

    /// Initializes a new instance of `BugReportConfig` with optional customization.
    ///
    /// - Parameters:
    ///   - colors: The color theme to be used. Defaults to `BugReportConfig.default.colors`.
    ///   - text: The localized text used in the UI. Defaults to `BugReportConfig.default.text`.
    ///   - dimensions: The layout spacing and padding. Defaults to `BugReportConfig.default.dimensions`.
    ///   - fonts: The fonts for labels, buttons, and descriptions. Defaults to `BugReportConfig.default.fonts`.
    public init(colors: MsrColors = BugReportConfig.default.colors,
                text: MsrText = BugReportConfig.default.text,
                dimensions: MsrDimensions = BugReportConfig.default.dimensions,
                fonts: MsrFonts = BugReportConfig.default.fonts) {
        self.colors = colors
        self.text = text
        self.dimensions = dimensions
        self.fonts = fonts
    }

    /// A default configuration with preset values for colors, text, dimensions, and fonts.
    ///
    /// This can be used when no customization is needed, or as a base to override specific settings.
    public static let `default` = BugReportConfig(
        colors: MsrColors(
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
        text: MsrText(
            reportBugTitle: "Report a bug",
            descriptionPlaceholder: "Briefly describe the issue you are facing.",
            sendButton: "Send",
            screenshotButton: "Screenshot",
            galleryButton: "Gallery",
            exitScreenshotMode: "Tap to exit Screenshot mode"
        ),
        dimensions: MsrDimensions(
            topPadding: 20
        ),
        fonts: MsrFonts(
            title: UIFont.boldSystemFont(ofSize: 18),
            button: UIFont.systemFont(ofSize: 14, weight: .semibold),
            placeholder: UIFont.systemFont(ofSize: 16)
        )
    )
}
