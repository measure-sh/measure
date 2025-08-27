//
//  LifecycleManagerInternalSwift.swift
//  Measure
//
//  Created by Adwin Ross on 27/08/25.
//

import Foundation
import UIKit

@objc public class LifecycleManagerInternalSwift: NSObject {
    @objc public static let shared = LifecycleManagerInternalSwift()

    @objc public func sendLifecycleEvent(_ event: VCLifecycleEventType,
                                         for viewController: UIViewController) {
        // Call into your real LifecycleManager logic
        LifecycleManager.shared.sendLifecycleEvent(event, for: viewController)
    }
}
