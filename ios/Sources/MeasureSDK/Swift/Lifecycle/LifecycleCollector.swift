//
//  LifecycleCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 27/10/24.
//

import Foundation
import UIKit
import SwiftUI

protocol LifecycleCollector {
    func applicationDidEnterBackground()
    func applicationWillEnterForeground()
    func applicationWillTerminate()
    func processControllerLifecycleEvent(_ vcLifecycleType: VCLifecycleEventType, for viewController: UIViewController)
    func processSwiftUILifecycleEvent(_ swiftUILifecycleType: SwiftUILifecycleType, for viewName: String)
    func enable()
}

class BaseLifecycleCollector: LifecycleCollector {
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private let logger: Logger

    init(eventProcessor: EventProcessor, timeProvider: TimeProvider, logger: Logger) {
        self.eventProcessor = eventProcessor
        self.timeProvider = timeProvider
        self.logger = logger
    }

    func enable() {
        UIViewController.swizzleLifecycleMethods()
        LifecycleManager.shared.setLifecycleCollector(self)
    }

    func applicationDidEnterBackground() {
        eventProcessor.track(data: ApplicationLifecycleData(type: .background),
                             timestamp: timeProvider.now(),
                             type: .lifecycleApp,
                             attributes: nil,
                             sessionId: nil,
                             attachments: nil,
                             userDefinedAttributes: nil)
    }

    func applicationWillEnterForeground() {
        eventProcessor.track(data: ApplicationLifecycleData(type: .foreground),
                             timestamp: timeProvider.now(),
                             type: .lifecycleApp,
                             attributes: nil,
                             sessionId: nil,
                             attachments: nil,
                             userDefinedAttributes: nil)
    }

    func applicationWillTerminate() {
        eventProcessor.track(data: ApplicationLifecycleData(type: .terminated),
                             timestamp: timeProvider.now(),
                             type: .lifecycleApp,
                             attributes: nil,
                             sessionId: nil,
                             attachments: nil,
                             userDefinedAttributes: nil)
    }

    func processControllerLifecycleEvent(_ vcLifecycleType: VCLifecycleEventType, for viewController: UIViewController) {
        let className = String(describing: type(of: viewController))

        // Define the list of excluded class names
        let excludedClassNames = [
            "UIHostingController",
            "UIKitNavigationController",
            "NavigationStackHostingController",
            "NotifyingMulticolumnSplitViewController",
            "StyleContextSplitViewNavigationController"
        ]

        // Check if the class name contains any of the excluded substrings
        let shouldTrackEvent = !excludedClassNames.contains { className.contains($0) }

        if shouldTrackEvent {
            eventProcessor.track(
                data: VCLifecycleData(type: vcLifecycleType.stringValue, className: className),
                timestamp: timeProvider.now(),
                type: .lifecycleViewController,
                attributes: nil,
                sessionId: nil,
                attachments: nil,
                userDefinedAttributes: nil)
        }
    }

    func processSwiftUILifecycleEvent(_ swiftUILifecycleType: SwiftUILifecycleType, for className: String) {
        eventProcessor.track(data: SwiftUILifecycleData(type: swiftUILifecycleType, className: className),
                             timestamp: timeProvider.now(),
                             type: .lifecycleSwiftUI,
                             attributes: nil,
                             sessionId: nil,
                             attachments: nil,
                             userDefinedAttributes: nil)
    }
}
