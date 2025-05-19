//
//  ScreenshotMaskLevel.swift
//  Measure
//
//  Created by Adwin Ross on 19/05/25.
//

import Foundation

/// The level of masking to apply to the screenshot.
public enum ScreenshotMaskLevel {
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
