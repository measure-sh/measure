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

/// A strategy to apply when swizzling methods.
enum SwizzlingStrategy {
    /// Exchanges implementations between the original and swizzled methods.
    /// Use when the original method definitely exists (e.g., UIKit lifecycle methods).
    case exchange

    /// Replaces the implementation of the original method with the swizzled one.
    /// Use when the original method might not exist (e.g., optional methods or dynamic injection).
    case replace
}

/// A utility class to safely swizzle methods at runtime while avoiding duplicate swizzling.
class SwizzlingUtility {
    private static var swizzledImplementations: [String: [IMP]] = [:]
    private static let swizzlingQueue = DispatchQueue(label: "com.measure.swizzling", attributes: .concurrent)

    /// Swizzles an instance method on a given class using the specified strategy.
    ///
    /// - Parameters:
    ///   - cls: The class whose method you want to swizzle.
    ///   - originalSelector: The selector of the original method.
    ///   - swizzledSelector: The selector of the new (swizzled) method.
    ///   - strategy: The strategy to use for swizzling (`exchange` or `replace`).
    static func swizzleMethod(
        for cls: AnyClass,
        originalSelector: Selector,
        swizzledSelector: Selector,
        strategy: SwizzlingStrategy = .exchange
    ) {
        let key = "\(NSStringFromClass(cls))-\(NSStringFromSelector(originalSelector))"

        swizzlingQueue.sync(flags: .barrier) {
            if swizzledImplementations[key] != nil { return }

            guard let originalMethod = class_getInstanceMethod(cls, originalSelector),
                  let swizzledMethod = class_getInstanceMethod(cls, swizzledSelector) else {
                print("Swizzling failed: \(originalSelector)")
                return
            }

            let originalIMP = method_getImplementation(originalMethod)
            swizzledImplementations[key] = [originalIMP]

            switch strategy {
            case .exchange:
                method_exchangeImplementations(originalMethod, swizzledMethod)

            case .replace:
                let swizzledIMP = method_getImplementation(swizzledMethod)
                let typeEncoding = method_getTypeEncoding(originalMethod)
                class_replaceMethod(cls, originalSelector, swizzledIMP, typeEncoding)
            }
        }
    }

    /// Returns the original implementation of a previously swizzled method, if available.
    /// 
    /// - Parameters:
    ///   - cls: The class containing the swizzled method.
    ///   - selector: The selector for which you want the original IMP.
    /// - Returns: The original `IMP` or `nil` if it hasn't been swizzled.
    static func originalIMP(for cls: AnyClass, selector: Selector) -> IMP? {
        let key = "\(NSStringFromClass(cls))-\(NSStringFromSelector(selector))"
        return swizzledImplementations[key]?.first
    }

    /// Reverts all previously swizzled methods back to their original implementations.
    /// Should typically only be used for debugging or cleanup during tests.
    static func unswizzleAll() {
        swizzlingQueue.sync(flags: .barrier) {
            for (key, imps) in swizzledImplementations {
                let components = key.split(separator: "-")
                guard components.count == 2,
                      let cls = NSClassFromString(String(components[0])) else { continue }

                let selector = NSSelectorFromString(String(components[1]))
                if let originalMethod = class_getInstanceMethod(cls, selector) {
                    method_setImplementation(originalMethod, imps.first!)
                }
            }

            swizzledImplementations.removeAll()
        }
    }
}
