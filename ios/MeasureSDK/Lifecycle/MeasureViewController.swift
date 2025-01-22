//
//  MeasureViewController.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 28/10/24.
//

import UIKit

open class MeasureViewController: UIViewController {
    open override func loadView() {
        super.loadView()
        LifecycleManager.shared.sendLifecycleEvent(.loadView, for: self)
    }

    deinit {
        LifecycleManager.shared.sendLifecycleEvent(.vcDeinit, for: self)
    }
}
