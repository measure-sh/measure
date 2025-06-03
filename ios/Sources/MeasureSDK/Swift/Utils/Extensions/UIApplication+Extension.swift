//
//  UIApplication+Extension.swift
//  Measure
//
//  Created by Adwin Ross on 03/06/25.
//

import Foundation
import UIKit

private var gestureCollectorKey: UInt8 = 0

extension UIApplication {
    private var gestureCollector: GestureCollector? {
        get {
            return objc_getAssociatedObject(self, &gestureCollectorKey) as? GestureCollector
        }
        set {
            objc_setAssociatedObject(self, &gestureCollectorKey, newValue, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
    }

    @objc func swizzled_sendEvent(_ event: UIEvent) {
        // Call gesture collector, if available
        gestureCollector?.processEvent(event)

        // Forward to the original sendEvent
        self.swizzled_sendEvent(event)
    }

    func setGestureCollector(_ collector: GestureCollector) {
        self.gestureCollector = collector
    }

    static func swizzleSendEvent() {
        let originalSelector = #selector(sendEvent(_:))
        let swizzledSelector = #selector(swizzled_sendEvent(_:))
        swizzleMethod(for: UIApplication.self,
                      originalSelector: originalSelector,
                      swizzledSelector: swizzledSelector)
    }
}
