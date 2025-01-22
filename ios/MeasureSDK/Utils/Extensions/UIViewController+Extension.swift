//
//  UIViewController+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 27/10/24.
//

import UIKit

extension UIViewController {
    @objc func swizzled_viewDidLoad() {
        LifecycleManager.shared.sendLifecycleEvent(.viewDidLoad, for: self)
        swizzled_viewDidLoad()
    }

    @objc func swizzled_viewWillAppear(_ animated: Bool) {
        LifecycleManager.shared.sendLifecycleEvent(.viewWillAppear, for: self)
        swizzled_viewWillAppear(animated)
    }

    @objc func swizzled_viewWillDisappear(_ animated: Bool) {
        LifecycleManager.shared.sendLifecycleEvent(.viewWillDisappear, for: self)
        swizzled_viewWillDisappear(animated)
    }

    @objc func swizzled_viewDidAppear(_ animated: Bool) {
        LifecycleManager.shared.sendLifecycleEvent(.viewDidAppear, for: self)
        swizzled_viewDidAppear(animated)
    }

    @objc func swizzled_didReceiveMemoryWarning() {
        LifecycleManager.shared.sendLifecycleEvent(.didReceiveMemoryWarning, for: self)
        swizzled_didReceiveMemoryWarning()
    }

    @objc func swizzled_viewDidDisappear(_ animated: Bool) {
        LifecycleManager.shared.sendLifecycleEvent(.viewDidDisappear, for: self)
        swizzled_viewDidDisappear(animated)
    }

    static func swizzleLifecycleMethods() {
        UIViewController.swizzleMethod(for: UIViewController.self,
                                       originalSelector: #selector(viewDidLoad),
                                       swizzledSelector: #selector(swizzled_viewDidLoad))
        UIViewController.swizzleMethod(for: UIViewController.self,
                                       originalSelector: #selector(viewWillAppear(_:)),
                                       swizzledSelector: #selector(swizzled_viewWillAppear(_:)))
        UIViewController.swizzleMethod(for: UIViewController.self,
                                       originalSelector: #selector(viewWillDisappear(_:)),
                                       swizzledSelector: #selector(swizzled_viewWillDisappear(_:)))
        UIViewController.swizzleMethod(for: UIViewController.self,
                                       originalSelector: #selector(viewDidAppear(_:)),
                                       swizzledSelector: #selector(swizzled_viewDidAppear(_:)))
        UIViewController.swizzleMethod(for: UIViewController.self,
                                       originalSelector: #selector(didReceiveMemoryWarning),
                                       swizzledSelector: #selector(swizzled_didReceiveMemoryWarning))
        UIViewController.swizzleMethod(for: UIViewController.self,
                                       originalSelector: #selector(viewDidDisappear(_:)),
                                       swizzledSelector: #selector(swizzled_viewDidDisappear(_:)))
    }
}
