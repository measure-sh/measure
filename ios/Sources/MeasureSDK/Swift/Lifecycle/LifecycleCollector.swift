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

final class BaseLifecycleCollector: LifecycleCollector {
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let tracer: Tracer
    private let configProvider: ConfigProvider
    private let logger: Logger
    private var isEnabled = AtomicBool(false)
    private var activeSpans: [String: Span] = [:]

    init(signalProcessor: SignalProcessor,
         timeProvider: TimeProvider,
         tracer: Tracer,
         configProvider: ConfigProvider,
         logger: Logger) {
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.tracer = tracer
        self.configProvider = configProvider
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
            logger.log(level: .info, message: "LifecycleCollector disabled.", error: nil, data: nil)
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
        guard isEnabled.get() else { return }

        let className = String(describing: type(of: viewController))

        // Filter out internal UIKit controllers we don't want to trace
        let excludedClassNames = [
            "UIHostingController",
            "UIKitNavigationController",
            "NavigationStackHostingController",
            "NotifyingMulticolumnSplitViewController",
            "StyleContextSplitViewController"
        ]

        guard !excludedClassNames.contains(where: { className.contains($0) }) else { return }

        trackEvent(VCLifecycleData(type: vcLifecycleType.stringValue, className: className), type: .lifecycleViewController)

        guard configProvider.trackViewControllerLoadTime else { return }

        switch vcLifecycleType {
        case .loadView:
            startViewControllerTtidSpan(for: viewController, className: className, checkpoint: CheckpointName.vcLoadView)
        case .viewDidLoad:
            // Only start span in viewDidLoad if we haven't already started it in loadView
            let key = ObjectIdentifier(viewController).debugDescription
            if activeSpans[key] == nil {
                startViewControllerTtidSpan(for: viewController, className: className, checkpoint: CheckpointName.vcViewDidLoad)
            } else if let span = activeSpans[key] {
                span.setCheckpoint(CheckpointName.vcViewDidLoad)
            }
        case .viewWillAppear:
            addCheckpoint(for: viewController, checkpoint: CheckpointName.vcViewWillAppear)
        case .viewDidAppear:
            endViewControllerTtidSpan(for: viewController, className: className)
        default:
            break
        }
    }

    func processSwiftUILifecycleEvent(_ swiftUILifecycleType: SwiftUILifecycleType, for className: String) {
        trackEvent(
            SwiftUILifecycleData(type: swiftUILifecycleType, className: className),
            type: .lifecycleSwiftUI
        )
    }

    // MARK: - TTID Span Tracking

    private func startViewControllerTtidSpan(for viewController: UIViewController, className: String, checkpoint: String) {
        let spanName = SpanName.viewControllerTtidSpan(className: className, maxLength: configProvider.maxSpanNameLength)
        let span = tracer
            .spanBuilder(name: spanName)
            .startSpan()
            .setCheckpoint(checkpoint)

        if viewController.isInitialViewController {
            span.setAttribute(AttributeName.appStartupFirstViewController, value: true)
        }

        let key = ObjectIdentifier(viewController).debugDescription
        activeSpans[key] = span
    }

    private func addCheckpoint(for viewController: UIViewController, checkpoint: String) {
        let key = ObjectIdentifier(viewController).debugDescription

        guard let span = activeSpans[key] else { return }

        span.setCheckpoint(checkpoint)
    }

    private func endViewControllerTtidSpan(for viewController: UIViewController, className: String) {
        let key = ObjectIdentifier(viewController).debugDescription

        guard let span = activeSpans[key] else { return }

        span.setCheckpoint(CheckpointName.vcViewDidAppear)

        DispatchQueue.main.async {
            span.setStatus(.ok).end()
            self.activeSpans.removeValue(forKey: key)
        }
    }

    // MARK: - Event tracking

    private func trackEvent(_ data: Codable, type: EventType) {
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
