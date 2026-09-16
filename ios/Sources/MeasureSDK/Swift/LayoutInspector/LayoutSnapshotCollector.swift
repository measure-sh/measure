//
//  LayoutSnapshotCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 10/09/26.
//

import UIKit

protocol LayoutSnapshotCollector {
    func captureAttachment(completion: @escaping (MsrAttachment?) -> Void)
}

final class BaseLayoutSnapshotCollector: LayoutSnapshotCollector {
    private let logger: Logger
    private let layoutSnapshotGenerator: LayoutSnapshotGenerator
    private let layoutSnapshotThrottler: LayoutSnapshotThrottler
    private let configProvider: ConfigProvider

    init(logger: Logger,
         layoutSnapshotGenerator: LayoutSnapshotGenerator,
         layoutSnapshotThrottler: LayoutSnapshotThrottler,
         configProvider: ConfigProvider) {
        self.logger = logger
        self.layoutSnapshotGenerator = layoutSnapshotGenerator
        self.layoutSnapshotThrottler = layoutSnapshotThrottler
        self.configProvider = configProvider
    }

    func captureAttachment(completion: @escaping (MsrAttachment?) -> Void) {
        runOnMainThread { [weak self] in
            self?.capture(completion: completion)
        }
    }

    private func capture(completion: @escaping (MsrAttachment?) -> Void) {
        guard layoutSnapshotThrottler.shouldTakeSnapshot(delayMs: configProvider.layoutSnapshotDebounceInterval) else {
            logger.log(level: .debug, message: "LayoutSnapshotCollector: skipped, throttled", error: nil, data: nil)
            completion(nil)
            return
        }
        guard let window = UIWindow.keyWindow() else {
            logger.log(level: .debug, message: "LayoutSnapshotCollector: skipped, no key window found", error: nil, data: nil)
            completion(nil)
            return
        }

        layoutSnapshotGenerator.generate(for: window, touchPoint: nil) { attachment in
            completion(attachment)
        }
    }

    private func runOnMainThread(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }
}
