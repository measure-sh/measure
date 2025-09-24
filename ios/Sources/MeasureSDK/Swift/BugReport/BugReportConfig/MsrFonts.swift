//
//  MsrFonts.swift
//  Measure
//
//  Created by Adwin Ross on 26/05/25.
//

import UIKit

/// `MsrFonts` defines the font styles used throughout the bug reporting UI.
public class MsrFonts: NSObject {
    /// The font used for title labels and headings in the UI.
    public let title: UIFont

    /// The font used for buttons in the UI.
    public let button: UIFont

    /// The font used for placeholder text and textView.
    public let placeholder: UIFont

    public init(title: UIFont, button: UIFont, placeholder: UIFont) {
        self.title = title
        self.button = button
        self.placeholder = placeholder
    }

    public func update(
        title: UIFont? = nil,
        button: UIFont? = nil,
        placeholder: UIFont? = nil
    ) -> MsrFonts {
        return MsrFonts(
            title: title ?? self.title,
            button: button ?? self.button,
            placeholder: placeholder ?? self.placeholder
        )
    }
}
