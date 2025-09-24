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
    /// Forwards the event to `LifecycleManager` for tracking.
    @objc func swizzled_viewDidLoad() {
        swizzled_viewDidLoad()
        LifecycleManager.shared.sendLifecycleEvent(.viewDidLoad, for: self)
    }

    /// Swizzled implementation of `viewWillAppear`.
    @objc func swizzled_viewWillAppear(_ animated: Bool) {
        swizzled_viewWillAppear(animated)
        LifecycleManager.shared.sendLifecycleEvent(.viewWillAppear, for: self)
    }

    /// Swizzled implementation of `viewDidAppear`.
    @objc func swizzled_viewDidAppear(_ animated: Bool) {
        swizzled_viewDidAppear(animated)
        LifecycleManager.shared.sendLifecycleEvent(.viewDidAppear, for: self)
    }

    /// Swizzled implementation of `viewWillDisappear`.
    @objc func swizzled_viewWillDisappear(_ animated: Bool) {
        swizzled_viewWillDisappear(animated)
        LifecycleManager.shared.sendLifecycleEvent(.viewWillDisappear, for: self)
    }

    /// Swizzled implementation of `viewDidDisappear`.
    @objc func swizzled_viewDidDisappear(_ animated: Bool) {
        swizzled_viewDidDisappear(animated)
        LifecycleManager.shared.sendLifecycleEvent(.viewDidDisappear, for: self)
    }

    /// Swizzled implementation of `didReceiveMemoryWarning`.
    @objc func swizzled_didReceiveMemoryWarning() {
        swizzled_didReceiveMemoryWarning()
        LifecycleManager.shared.sendLifecycleEvent(.didReceiveMemoryWarning, for: self)
    }

    // MARK: - Swizzling Setup

    /// Performs method swizzling for all key UIViewController lifecycle events.
    ///
    /// This method should be called once (typically during SDK initialization)
    /// to enable lifecycle tracking across all view controllers.
    static func swizzleLifecycleMethods() {
        let methods: [(Selector, Selector)] = [
            (#selector(viewDidLoad), #selector(swizzled_viewDidLoad)),
            (#selector(viewWillAppear(_:)), #selector(swizzled_viewWillAppear(_:))),
            (#selector(viewDidAppear(_:)), #selector(swizzled_viewDidAppear(_:))),
            (#selector(viewWillDisappear(_:)), #selector(swizzled_viewWillDisappear(_:))),
            (#selector(viewDidDisappear(_:)), #selector(swizzled_viewDidDisappear(_:))),
            (#selector(didReceiveMemoryWarning), #selector(swizzled_didReceiveMemoryWarning))
        ]

        for (original, swizzled) in methods {
            SwizzlingUtility.swizzleMethod(
                for: UIViewController.self,
                originalSelector: original,
                swizzledSelector: swizzled,
                strategy: .exchange
            )
        }
    }
}
