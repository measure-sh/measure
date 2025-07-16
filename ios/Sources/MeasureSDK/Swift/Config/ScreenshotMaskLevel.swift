//
//  ScreenshotMaskLevel.swift
//  Measure
//
//  Created by Adwin Ross on 19/05/25.
//

import Foundation

/// The level of masking to apply to the screenshot.
public enum ScreenshotMaskLevel: String, Codable, CaseIterable {
    /// The strictest level of masking which masks all text, input fields, images and videos.
    case allTextAndMedia

    /// Masks all text and input fields, including clickable elements.
    case allText

    /// Masks all text and input fields, excluding clickable elements.
    case allTextExceptClickable

    /// The most lenient level of masking which only masks sensitive input fields like passwords,
    /// email and phone number fields.
    case sensitiveFieldsOnly
}

/// The level of masking to apply to the screenshot.
@objc public enum ScreenshotMaskLevelObjc: Int {
    /// The strictest level of masking which masks all text, input fields, images and videos.
    case allTextAndMedia

    /// Masks all text and input fields, including clickable elements.
    case allText

    /// Masks all text and input fields, excluding clickable elements.
    case allTextExceptClickable

    /// The most lenient level of masking which only masks sensitive input fields like passwords,
    /// email and phone number fields.
    case sensitiveFieldsOnly

    func toSwiftValue() -> ScreenshotMaskLevel {
        switch self {
        case .allTextAndMedia:
            return .allTextAndMedia
        case .allText:
            return .allText
        case .allTextExceptClickable:
            return .allTextExceptClickable
        case .sensitiveFieldsOnly:
            return .sensitiveFieldsOnly
        }
    }
}
