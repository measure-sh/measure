//
//  MsrRedactViewHelper.swift
//  Measure
//
//  Created by Adwin Ross on 25/04/26.
//

import UIKit
import ObjectiveC.NSObjCRuntime

final class MsrRedactViewHelper: NSObject {
    private static var maskedHandle: UInt8 = 0
    private static var unmaskedHandle: UInt8 = 0

    private override init() {}

    static func maskView(_ view: UIView) {
        objc_setAssociatedObject(view, &maskedHandle, true, .OBJC_ASSOCIATION_ASSIGN)
    }

    static func unmaskView(_ view: UIView) {
        objc_setAssociatedObject(view, &unmaskedHandle, true, .OBJC_ASSOCIATION_ASSIGN)
    }

    static func shouldMask(_ view: UIView) -> Bool {
        (objc_getAssociatedObject(view, &maskedHandle) as? NSNumber)?.boolValue ?? false
    }

    static func shouldUnmask(_ view: UIView) -> Bool {
        (objc_getAssociatedObject(view, &unmaskedHandle) as? NSNumber)?.boolValue ?? false
    }
}
