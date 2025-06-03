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
        if #available(iOS 13.0, *) {
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }
        } else {
            return UIApplication.shared.windows.first(where: { $0.isKeyWindow })
        }
    }
}
