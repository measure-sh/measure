//
//  LifecycleManagerInternal.swift
//  Measure
//
//  Created by Adwin Ross on 28/08/25.
//

import Foundation
import UIKit

@objc(LifecycleManagerInternal)
public class LifecycleManagerInternal: NSObject {
    @objc public static let shared = LifecycleManagerInternal()

    @objc public func sendLifecycleEvent(_ event: VCLifecycleEventType,
                                         for viewController: UIViewController) {
        LifecycleManager.shared.sendLifecycleEvent(event, for: viewController)
    }
}
