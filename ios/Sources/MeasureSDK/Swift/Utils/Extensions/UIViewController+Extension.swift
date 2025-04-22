//
//  UIViewController+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 27/10/24.
//

import UIKit

extension UIViewController {
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
