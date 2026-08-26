//
//  UIWindow+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 30/09/24.
//

import UIKit

extension UIWindow {
    /// Returns the current key window in the active scene.
    static func keyWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
}
