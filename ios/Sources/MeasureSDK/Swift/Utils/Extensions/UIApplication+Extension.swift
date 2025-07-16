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
        gestureCollector?.processEvent(event)

        if let imp = SwizzlingUtility.originalIMP(for: UIApplication.self, selector: #selector(sendEvent(_:))) {
            typealias SendEventFunc = @convention(c) (UIApplication, Selector, UIEvent) -> Void
            let original = unsafeBitCast(imp, to: SendEventFunc.self)
            original(self, #selector(sendEvent(_:)), event)
        }
    }

    func setGestureCollector(_ collector: GestureCollector) {
        self.gestureCollector = collector
    }

    static func swizzleSendEvent() {
        SwizzlingUtility.swizzleMethod(
            for: UIApplication.self,
            originalSelector: #selector(sendEvent(_:)),
            swizzledSelector: #selector(swizzled_sendEvent(_:)),
            strategy: .replace
        )
    }
}
