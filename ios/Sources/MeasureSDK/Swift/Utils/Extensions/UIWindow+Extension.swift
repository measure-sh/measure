//
//  UIWindow+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 30/09/24.
//

import UIKit

private var gestureCollectorKey: UInt8 = 0

extension UIWindow {
    private var gestureCollector: GestureCollector? {
        get {
            return objc_getAssociatedObject(self, &gestureCollectorKey) as? GestureCollector
        }
        set {
            objc_setAssociatedObject(self, &gestureCollectorKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }

    @objc func swizzled_sendEvent(_ event: UIEvent) {
        guard let gestureCollector = gestureCollector else { return }
        gestureCollector.processEvent(event)
        self.swizzled_sendEvent(event) // Call the original sendEvent
    }

    func swizzleSendEvent() {
        let originalSelector = #selector(UIWindow.sendEvent(_:))
        let swizzledSelector = #selector(UIWindow.swizzled_sendEvent(_:))

        UIWindow.swizzleMethod(for: UIWindow.self, originalSelector: originalSelector, swizzledSelector: swizzledSelector)
    }

    func setGestureCollector(_ collector: GestureCollector) {
        self.gestureCollector = collector
    }

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
