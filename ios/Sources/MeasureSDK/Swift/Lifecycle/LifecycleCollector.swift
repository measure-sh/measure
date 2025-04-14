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
    func disable()
}

class BaseLifecycleCollector: LifecycleCollector {
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let logger: Logger
    private var isEnabled = AtomicBool(false)

    init(signalProcessor: SignalProcessor, timeProvider: TimeProvider, logger: Logger) {
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.logger = logger
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            UIViewController.swizzleLifecycleMethods()
            LifecycleManager.shared.setLifecycleCollector(self)
            logger.log(level: .info, message: "LifecycleCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(level: .info, message: "LifecycleCollector enabled.", error: nil, data: nil)
        }
    }

    func applicationDidEnterBackground() {
        trackEvent(ApplicationLifecycleData(type: .background), type: .lifecycleApp)
    }

    func applicationWillEnterForeground() {
        trackEvent(ApplicationLifecycleData(type: .foreground), type: .lifecycleApp)
    }

    func applicationWillTerminate() {
        trackEvent(ApplicationLifecycleData(type: .terminated), type: .lifecycleApp)
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
            trackEvent(VCLifecycleData(type: vcLifecycleType.stringValue, className: className), type: .lifecycleViewController)
        }
    }

    func processSwiftUILifecycleEvent(_ swiftUILifecycleType: SwiftUILifecycleType, for className: String) {
        trackEvent(SwiftUILifecycleData(type: swiftUILifecycleType, className: className), type: .lifecycleSwiftUI)
    }

    private func trackEvent(_ data: Codable, type: EventType) {
        guard isEnabled.get() else { return }
        signalProcessor.track(data: data,
                              timestamp: timeProvider.now(),
                              type: type,
                              attributes: nil,
                              sessionId: nil,
                              attachments: nil,
                              userDefinedAttributes: nil,
                              threadName: nil)
    }
}
