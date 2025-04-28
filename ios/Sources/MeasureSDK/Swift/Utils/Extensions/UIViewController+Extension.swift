//
//  UIViewController+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 27/10/24.
//

import UIKit

extension UIViewController {
    /// Returns true if the view controller is considered the initial/root controller of the app
    var isInitialViewController: Bool {
        // Check if this is the root view controller
        if #available(iOS 13.0, *) {
            if let windowScene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
               let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController {
                return self === rootVC || isInitial(in: rootVC)
            }
        }

        // Fallback to AppDelegate window
        if let rootVC = UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController {
            return self === rootVC || isInitial(in: rootVC)
        }

        return false
    }

    private func isInitial(in rootVC: UIViewController) -> Bool {
        // If self is embedded in UINavigationController
        if let nav = rootVC as? UINavigationController {
            return nav.viewControllers.first === self
        }

        // If self is part of a UITabBarController
        if let tab = rootVC as? UITabBarController {
            if tab.selectedViewController === self {
                return true
            }

            if let nav = tab.selectedViewController as? UINavigationController {
                return nav.viewControllers.first === self
            }

            return tab.viewControllers?.first === self
        }

        // If self is embedded in a container view controller
        if let container = rootVC as? UIPageViewController {
            return container.viewControllers?.first === self
        }

        return false
    }

    /// Swizzled implementation of `viewDidLoad`.
    /// Sends a lifecycle event for `viewDidLoad` and calls the original implementation.
    @objc func swizzled_viewDidLoad() {
        // Call the original implementation (or the previously swizzled implementation)
        swizzled_viewDidLoad()

        // Send the lifecycle event
        LifecycleManager.shared.sendLifecycleEvent(.viewDidLoad, for: self)
    }

    /// Swizzled implementation of `viewWillAppear`.
    /// Sends a lifecycle event for `viewWillAppear` and calls the original implementation.
    @objc func swizzled_viewWillAppear(_ animated: Bool) {
        swizzled_viewWillAppear(animated)
        LifecycleManager.shared.sendLifecycleEvent(.viewWillAppear, for: self)
    }

    /// Swizzled implementation of `viewWillDisappear`.
    /// Sends a lifecycle event for `viewWillDisappear` and calls the original implementation.
    @objc func swizzled_viewWillDisappear(_ animated: Bool) {
        swizzled_viewWillDisappear(animated)
        LifecycleManager.shared.sendLifecycleEvent(.viewWillDisappear, for: self)
    }

    /// Swizzled implementation of `viewDidAppear`.
    /// Sends a lifecycle event for `viewDidAppear` and calls the original implementation.
    @objc func swizzled_viewDidAppear(_ animated: Bool) {
        swizzled_viewDidAppear(animated)
        LifecycleManager.shared.sendLifecycleEvent(.viewDidAppear, for: self)
    }

    /// Swizzled implementation of `didReceiveMemoryWarning`.
    /// Sends a lifecycle event for `didReceiveMemoryWarning` and calls the original implementation.
    @objc func swizzled_didReceiveMemoryWarning() {
        swizzled_didReceiveMemoryWarning()
        LifecycleManager.shared.sendLifecycleEvent(.didReceiveMemoryWarning, for: self)
    }

    /// Swizzled implementation of `viewDidDisappear`.
    /// Sends a lifecycle event for `viewDidDisappear` and calls the original implementation.
    @objc func swizzled_viewDidDisappear(_ animated: Bool) {
        swizzled_viewDidDisappear(animated)
        LifecycleManager.shared.sendLifecycleEvent(.viewDidDisappear, for: self)
    }

    /// Swizzles the lifecycle methods of `UIViewController` to track lifecycle events.
    static func swizzleLifecycleMethods() {
        let methodsToSwizzle: [(Selector, Selector)] = [
            (#selector(viewDidLoad), #selector(swizzled_viewDidLoad)),
            (#selector(viewWillAppear(_:)), #selector(swizzled_viewWillAppear(_:))),
            (#selector(viewWillDisappear(_:)), #selector(swizzled_viewWillDisappear(_:))),
            (#selector(viewDidAppear(_:)), #selector(swizzled_viewDidAppear(_:))),
            (#selector(didReceiveMemoryWarning), #selector(swizzled_didReceiveMemoryWarning)),
            (#selector(viewDidDisappear(_:)), #selector(swizzled_viewDidDisappear(_:)))
        ]

        for (originalSelector, swizzledSelector) in methodsToSwizzle {
            SwizzlingUtility.swizzleMethod(for: UIViewController.self,
                                           originalSelector: originalSelector,
                                           swizzledSelector: swizzledSelector)
        }
    }
}
