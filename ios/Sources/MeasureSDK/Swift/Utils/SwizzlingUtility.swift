//
//  SwizzlingUtility.swift
//  Measure
//
//  Created by Adwin Ross on 22/04/25.
//

import Foundation

/// A dictionary to track swizzled methods and their implementations to prevent duplicate swizzling and maintain compatibility with other SDKs.
private var swizzledImplementations: [String: [IMP]] = [:]

/// A concurrent queue to ensure thread-safe swizzling operations.
private let swizzlingQueue = DispatchQueue(label: "com.measure.swizzling", attributes: .concurrent)

class SwizzlingUtility {
    /// Swizzles a method for a given class.
    /// - Parameters:
    ///   - cls: The class whose method should be swizzled.
    ///   - originalSelector: The original method selector.
    ///   - swizzledSelector: The swizzled method selector.
    static func swizzleMethod(for cls: AnyClass, originalSelector: Selector, swizzledSelector: Selector) {
        let key = "\(NSStringFromClass(cls))-\(NSStringFromSelector(originalSelector))"

        swizzlingQueue.sync(flags: .barrier) {
            // Prevent duplicate swizzling within this SDK
            if swizzledImplementations[key] != nil { return }

            guard let originalMethod = class_getInstanceMethod(cls, originalSelector),
                  let swizzledMethod = class_getInstanceMethod(cls, swizzledSelector) else {
                print("Swizzling failed: Method not found for \(NSStringFromSelector(originalSelector))")
                return
            }

            // Save the original implementation
            let originalIMP = method_getImplementation(originalMethod)
            swizzledImplementations[key] = [originalIMP]

            // Replace the original implementation with the swizzled one
            method_exchangeImplementations(originalMethod, swizzledMethod)
        }
    }

    /// Restores the original implementations of all swizzled methods.
    static func unswizzleAll() {
        swizzlingQueue.sync(flags: .barrier) {
            for (key, imps) in swizzledImplementations {
                let components = key.split(separator: "-")
                guard components.count == 2,
                      let cls = NSClassFromString(String(components[0])) else { continue }

                let selector = NSSelectorFromString(String(components[1]))
                if let originalMethod = class_getInstanceMethod(cls, selector) {
                    // Restore the first implementation in the list (original implementation)
                    method_setImplementation(originalMethod, imps.first!)
                }
            }

            swizzledImplementations.removeAll()
        }
    }
}
