//
//  UIWindow+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 30/09/24.
//

import UIKit

extension UIWindow {
    private static var gestureCollector: GestureCollector?

    @objc func swizzled_sendEvent(_ event: UIEvent) {
        guard let gestureRecognizers = UIWindow.gestureCollector else { return }
        gestureRecognizers.processEvent(event)
        self.swizzled_sendEvent(event)
    }

    static func swizzleSendEvent() {
        let originalSelector = #selector(UIWindow.sendEvent(_:))
        let swizzledSelector = #selector(UIWindow.swizzled_sendEvent(_:))

        swizzleMethod(for: UIWindow.self, originalSelector: originalSelector, swizzledSelector: swizzledSelector)
    }

    static func setGestureCollector(_ collector: GestureCollector) {
        UIWindow.gestureCollector = collector
    }
}
