//
//  LayoutSnapshotGenerator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/02/25.
//

import UIKit

protocol LayoutSnapshotGenerator {
    func generate(window: UIWindow, touchPoint: CGPoint, completion: @escaping (Attachment?) -> Void)
    func generate(for viewController: UIViewController, completion: @escaping (Attachment?) -> Void)
}

final class BaseLayoutSnapshotGenerator: LayoutSnapshotGenerator {
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let timeProvider: TimeProvider
    private var lastSnapshotTime: Number = 0
    private let attachmentProcessor: AttachmentProcessor
    private let svgGenerator: SvgGenerator

    init(
        logger: Logger,
        configProvider: ConfigProvider,
        timeProvider: TimeProvider,
        attachmentProcessor: AttachmentProcessor,
        svgGenerator: SvgGenerator
    ) {
        self.logger = logger
        self.configProvider = configProvider
        self.timeProvider = timeProvider
        self.attachmentProcessor = attachmentProcessor
        self.svgGenerator = svgGenerator
    }

    func generate(window: UIWindow, touchPoint: CGPoint, completion: @escaping (Attachment?) -> Void) {
        SignPost.trace(subcategory: "Attachment", label: "generateLayoutSnapshot") {
            let currentTime = timeProvider.now()
            guard currentTime - lastSnapshotTime > configProvider.layoutSnapshotDebounceInterval else {
                logger.log(level: .debug, message: "Debounced duplicate snapshot request.", error: nil, data: nil)
                completion(nil)
                return
            }

            lastSnapshotTime = currentTime

            let targetView = window.hitTest(touchPoint, with: nil)
            let frames = collectSvgFrames(in: window, rootView: window, targetView: targetView)

            DispatchQueue.main.async { [weak self] in
                guard let self = self,
                      let layoutSnapshot = self.svgGenerator.generate(for: frames) else {
                    completion(nil)
                    return
                }

                let attachment = self.attachmentProcessor.getAttachmentObject(
                    for: layoutSnapshot,
                    name: layoutSnapshotName,
                    storageType: .data,
                    attachmentType: .layoutSnapshot
                )
                completion(attachment)
            }
        }
    }

    func generate(for viewController: UIViewController, completion: @escaping (Attachment?) -> Void) {
        guard let rootView = viewController.view else {
            completion(nil)
            return
        }

        let frames = collectSvgFrames(in: rootView, rootView: rootView, targetView: nil)

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let layoutSnapshot = self.svgGenerator.generate(for: frames) else {
                completion(nil)
                return
            }
            
            let attachment = attachmentProcessor.getAttachmentObject(
                for: layoutSnapshot,
                name: layoutSnapshotName,
                storageType: .data,
                attachmentType: .layoutSnapshot
            )
            completion(attachment)
        }
    }

    private func collectSvgFrames(in view: UIView, rootView: UIView, targetView: UIView?) -> [SvgFrame] {
        var frames: [SvgFrame] = []

        let frameInRootView = view.convert(view.bounds, to: rootView)
        let isTarget = (targetView != nil && view === targetView)
        frames.append(SvgFrame(frame: frameInRootView, isTarget: isTarget))

        for subview in view.subviews {
            frames.append(contentsOf: collectSvgFrames(in: subview, rootView: rootView, targetView: targetView))
        }

        return frames
    }
}
