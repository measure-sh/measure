//
//  MsrDimensions.swift
//  Measure
//
//  Created by Adwin Ross on 26/05/25.
//

import Foundation

/// `MsrDimensions` encapsulates layout-related constants used throughout the bug report UI.
public class MsrDimensions: NSObject {
    /// The vertical spacing from the safeArea of the screen to the `Tap to exit Screenshot mode` button. Defaults to 20.
    public let topPadding: CGFloat

    public init(topPadding: CGFloat) {
        self.topPadding = topPadding
    }

    public func update(topPadding: CGFloat? = nil) -> MsrDimensions {
        return MsrDimensions(topPadding: topPadding ?? self.topPadding)
    }
}
