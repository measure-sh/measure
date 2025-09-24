//
//  MsrColors.swift
//  Measure
//
//  Created by Adwin Ross on 26/05/25.
//

import UIKit

/// `MsrColors` defines the full color scheme for the bug report UI, supporting both dark and light modes with theme-specific overrides.
///
/// It provides computed properties to automatically select the correct color variant based on the `isDarkMode` flag, which makes theme-switching seamless.
public class MsrColors: NSObject {
    /// Background color for dark mode.
    public let darkBackground: UIColor

    /// Background color for light mode.
    public let lightBackground: UIColor

    /// Button background color for dark mode.
    public let darkButtonBackground: UIColor

    /// Button background color for light mode.
    public let lightButtonBackground: UIColor

    /// Text color for dark mode.
    public let darkText: UIColor

    /// Text color for light mode.
    public let lightText: UIColor

    /// Placeholder text color for dark mode.
    public let darkPlaceholder: UIColor

    /// Placeholder text color for light mode.
    public let lightPlaceholder: UIColor

    /// Floating button background color for dark mode.
    public let darkFloatingButtonBackground: UIColor

    /// Floating button background color for light mode.
    public let lightFloatingButtonBackground: UIColor

    /// Floating button icon color for dark mode.
    public let darkFloatingButtonIcon: UIColor

    /// Floating button icon color for light mode.
    public let lightFloatingButtonIcon: UIColor

    /// Exit button text color in floating UI for dark mode.
    public let darkfloatingExitButtonText: UIColor

    /// Exit button text color in floating UI for light mode.
    public let lightfloatingExitButtonText: UIColor

    /// Badge background color used for notifications or alerts.
    public let badgeColor: UIColor

    /// Text color used on badges.
    public let badgeTextColor: UIColor

    /// Flag indicating whether the UI is in dark mode.
    public let isDarkMode: Bool

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
    ) -> MsrColors {
        return MsrColors(
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
