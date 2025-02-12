//
//  LayoutSnapshotGenerator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/02/25.
//

import UIKit

protocol LayoutSnapshotGenerator {
    func generate(window: UIWindow, touchPoint: CGPoint) -> Attachment?
}

final class BaseLayoutSnapshotGenerator: LayoutSnapshotGenerator {
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let timeProvider: TimeProvider
    private var lastSnapshotTime: Number = 0
    private let attachmentProcessor: AttachmentProcessor
    private let svgGenerator: SvgGenerator

    init(logger: Logger, configProvider: ConfigProvider, timeProvider: TimeProvider, attachmentProcessor: AttachmentProcessor, svgGenerator: SvgGenerator) {
        self.logger = logger
        self.configProvider = configProvider
        self.timeProvider = timeProvider
        self.attachmentProcessor = attachmentProcessor
        self.svgGenerator = svgGenerator
    }

    func generate(window: UIWindow, touchPoint: CGPoint) -> Attachment? {
        let currentTime = timeProvider.now()
        guard currentTime - lastSnapshotTime > configProvider.layoutSnapshotDebounceInterval else {
            logger.log(level: .debug, message: "Debounced duplicate snapshot request.", error: nil, data: nil)
            return nil
        }

        lastSnapshotTime = currentTime

        // Find the view at the touch point
        let targetView = window.hitTest(touchPoint, with: nil)

        guard let layoutSnapshot = svgGenerator.generate(for: window, frames: collectFrames(in: window, rootView: window), targetView: targetView) else {
            logger.log(level: .debug, message: "Failed to compress image.", error: nil, data: nil)
            return nil
        }

        return attachmentProcessor.getAttachmentObject(for: layoutSnapshot,
                                                name: layoutSnapshotName,
                                                storageType: .data,
                                                attachmentType: .layoutSnapshot)
    }

    private func collectFrames(in view: UIView, rootView: UIView) -> [CGRect] {
        var frames: [CGRect] = []
        let frameInRootView = view.convert(view.bounds, to: rootView)
        frames.append(frameInRootView)

        for subview in view.subviews {
            frames.append(contentsOf: collectFrames(in: subview, rootView: rootView))
        }

        return frames
    }
}
