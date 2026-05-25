//
//  LayoutSnapshotGenerator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/02/25.
//

import UIKit

protocol LayoutSnapshotGenerator {
    func generate(for window: UIWindow, touchPoint: CGPoint, completion: @escaping (MsrAttachment?) -> Void)
}

final class BaseLayoutSnapshotGenerator: LayoutSnapshotGenerator {
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let timeProvider: TimeProvider
    private var lastSnapshotTime: Number = 0
    private let attachmentProcessor: AttachmentProcessor
    private let measureDispatchQueue: MeasureDispatchQueue
    // Since iOS 26, overlay views are added on top of the view hierarchy as part of the Liquid Glass UI.
    // These views obstruct the layout snapshot traversal and are ignored.
    private let ignoredViewClassNames = ["FloatingBarHostingView", "FloatingBarContainerView"]
    private let scrollableTypes = [UIScrollView.self, UIDatePicker.self, UIPickerView.self]

    init(logger: Logger,
         configProvider: ConfigProvider,
         timeProvider: TimeProvider,
         attachmentProcessor: AttachmentProcessor,
         measureDispatchQueue: MeasureDispatchQueue) {
        self.logger = logger
        self.configProvider = configProvider
        self.timeProvider = timeProvider
        self.attachmentProcessor = attachmentProcessor
        self.measureDispatchQueue = measureDispatchQueue
    }

    func generate(for window: UIWindow, touchPoint: CGPoint, completion: @escaping (MsrAttachment?) -> Void) {
        SignPost.trace(subcategory: "Attachment", label: "generateLayoutSnapshotJson") {
            let targetView = window.hitTest(touchPoint, with: nil)
            let node = buildSnapshotNode(for: window, rootView: window, targetView: targetView)

            measureDispatchQueue.submit { [weak self] in
                guard let self else {
                    completion(nil)
                    return
                }

                guard let jsonData = try? JSONEncoder().encode(node),
                      let jsonString = String(data: jsonData, encoding: .utf8),
                      let jsonStringData = jsonString.data(using: .utf8) else {
                    self.logger.log(level: .error, message: "LayoutSnapshotGenerator: Failed to encode SnapshotNode to JSON string.", error: nil, data: nil)
                    completion(nil)
                    return
                }

                let attachment = self.attachmentProcessor.getAttachmentObject(for: jsonStringData,
                                                                              storageType: .gzip,
                                                                              attachmentType: .layoutSnapshotJson)

                completion(attachment)
            }
        }
    }

    private func buildSnapshotNode(for view: UIView, rootView: UIView, targetView: UIView?) -> SnapshotNode {
        let frameInRoot = view.convert(view.bounds, to: rootView)
        let isTarget = targetView != nil && view === targetView

        let children = view.subviews
            .filter { subview in
                let name = String(describing: type(of: subview))
                return !ignoredViewClassNames.contains(where: { name.contains($0) })
            }
            .map {
                buildSnapshotNode(for: $0, rootView: rootView, targetView: targetView)
            }

        return SnapshotNode(label: resolveLabel(for: view),
                            type: resolveElementType(for: view),
                            x: frameInRoot.origin.x,
                            y: frameInRoot.origin.y,
                            width: frameInRoot.size.width,
                            height: frameInRoot.size.height,
                            highlighted: isTarget,
                            scrollable: scrollableTypes.contains(where: { view.isKind(of: $0) }),
                            children: children)
    }

    private func resolveElementType(for view: UIView) -> ElementType {
        switch view {
        case is UIButton: return .button
        case is UILabel: return .text
        case is UITextField,
             is UITextView: return .input
        case is UIImageView: return .image
        case is UISlider: return .slider
        case is UIProgressView: return .progress
        case is UISwitch: return .checkbox
        case is UITableView,
             is UICollectionView: return .list
        case is UIScrollView: return .container
        case is UIPickerView,
             is UISegmentedControl: return .dropdown
        default: return .container
        }
    }

    private func resolveLabel(for view: UIView) -> String {
        if let label = view.accessibilityLabel, !label.isEmpty {
            return label
        }

        return String(describing: type(of: view))
    }
}
