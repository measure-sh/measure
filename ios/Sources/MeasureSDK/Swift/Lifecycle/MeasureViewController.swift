//
//  MeasureViewController.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 28/10/24.
//

import UIKit
/// A view controller that monitors the `loadView` and `deinit` lifecycle events of the view controller.
/// This class is intended to be subclassed by view controllers that need to monitor the view controller lifecycle.
/// 
/// - Example:
///   ```swift
///   class ViewController: MeasureViewController {
///     ...
///   }
///   ```
open class MeasureViewController: UIViewController {
    open override func loadView() {
        super.loadView()
        LifecycleManager.shared.sendLifecycleEvent(.loadView, for: self)
    }

    deinit {
        LifecycleManager.shared.sendLifecycleEvent(.vcDeinit, for: self)
    }
}
