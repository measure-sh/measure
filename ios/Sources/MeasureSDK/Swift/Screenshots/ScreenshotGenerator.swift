//
//  ScreenshotGenerator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/01/25.
//

import UIKit
import WebKit
import AVKit

protocol ScreenshotGenerator {
    func generate(window: UIWindow,
                  name: String,
                  storageType: AttachmentStorageType,
                  completion: @escaping (MsrAttachment?) -> Void)

    func generate(viewController: UIViewController,
                  completion: @escaping (MsrAttachment?) -> Void)
}

final class BaseScreenshotGenerator: ScreenshotGenerator {
    private let configProvider: ConfigProvider
    private let maskColor: UIColor
    private let logger: Logger
    private let attachmentProcessor: AttachmentProcessor
    private let userPermissionManager: UserPermissionManager

    /// Class name fragments that trigger masking via name matching.
    /// Used for SwiftUI backing views that don't appear as known UIView
    /// subclasses. _UIHostingView blanket-masks all SwiftUI content by
    /// default — use .msrUnmask() to opt specific views out.
    private let maskedClassNameFragments: [String] = [
        "RCTParagraphTextView",
        "_UIHostingView"
    ]

    /// Class name fragments whose subtrees are skipped during traversal
    /// to prevent crashes from accessing problematic private layers.
    private let traversalBlocklist: [String] = {
        var blocklist: [String] = []
        if #available(iOS 26.0, *) {
            blocklist.append("CameraUI.ChromeSwiftUIView")
        }
        return blocklist
    }()

    init(configProvider: ConfigProvider,
         logger: Logger,
         attachmentProcessor: AttachmentProcessor,
         userPermissionManager: UserPermissionManager) {
        self.configProvider = configProvider
        self.maskColor = UIColor(hex: configProvider.screenshotMaskHexColor) ?? .black
        self.logger = logger
        self.attachmentProcessor = attachmentProcessor
        self.userPermissionManager = userPermissionManager
    }

    func generate(window: UIWindow,
                  name: String,
                  storageType: AttachmentStorageType,
                  completion: @escaping (MsrAttachment?) -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                completion(nil)
                return
            }

            SignPost.trace(subcategory: "Attachment", label: "generateScreenshot") {
                let typesToMask = self.typesToMask(for: self.configProvider.screenshotMaskLevel)
                let result = self.findSensitiveFrames(in: window, rootView: window, types: typesToMask)

                // Subtract exempt frames from sensitive frames
                var sensitiveFrames = result.sensitive
                if !result.exempt.isEmpty {
                    sensitiveFrames = sensitiveFrames.filter { frame in
                        !result.exempt.contains { $0.intersects(frame) }
                    }
                }

                let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
                let screenshot = renderer.image { _ in
                    window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
                }

                guard let redactedImage = self.redactScreenshot(
                    screenshot,
                    sensitiveFrames: sensitiveFrames,
                    maskColor: self.maskColor
                ) else {
                    completion(nil)
                    return
                }

                guard let compressedData = WebPEncoder.encode(redactedImage, quality: CGFloat(self.configProvider.screenshotCompressionQuality) / 100.0) else {
                    self.logger.log(level: .debug, message: "ScreenshotGenerator: Failed to compress image.", error: nil, data: nil)
                    completion(nil)
                    return
                }

                let attachment = self.attachmentProcessor.getAttachmentObject(
                    for: compressedData,
                    storageType: storageType,
                    attachmentType: .screenshot
                )
                completion(attachment)
            }
        }
    }

    func generate(viewController: UIViewController,
                  completion: @escaping (MsrAttachment?) -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                completion(nil)
                return
            }

            guard let window = viewController.view.window else {
                self.logger.log(level: .debug, message: "ScreenshotGenerator: ViewController does not have an attached window.", error: nil, data: nil)
                completion(nil)
                return
            }

            self.generate(window: window, name: screenshotName, storageType: .data, completion: completion)
        }
    }

    private func findSensitiveFrames(in view: UIView, rootView: UIView, types: [UIView.Type]) -> (sensitive: [CGRect], exempt: [CGRect]) {
        var sensitive: [CGRect] = []
        var exempt: [CGRect] = []

        // Per-instance override from .msrMask() takes highest priority
        if MsrRedactViewHelper.shouldMask(view) {
            sensitive.append(view.convert(view.bounds, to: rootView))
        } else if MsrRedactViewHelper.shouldUnmask(view) {
            // Per-instance unmask — record frame for subtraction
            exempt.append(view.convert(view.bounds, to: rootView))
        } else {
            // Fall through to class-based and fragment-based checks
            let className = String(describing: type(of: view))
            let matchesType = types.contains { view.isKind(of: $0) }
            let matchesFragment = maskedClassNameFragments.contains { className.contains($0) }

            if matchesType || matchesFragment {
                sensitive.append(view.convert(view.bounds, to: rootView))
            }
        }

        // Skip subtree traversal for known crash-prone view types.
        // The view itself is still masked above if it matched — only
        // traversal into its children is skipped.
        let className = String(describing: type(of: view))
        let isBlocked = traversalBlocklist.contains { className.contains($0) }
        guard !isBlocked else {
            return (sensitive, exempt)
        }

        for subview in view.subviews {
            let result = findSensitiveFrames(in: subview, rootView: rootView, types: types)
            sensitive.append(contentsOf: result.sensitive)
            exempt.append(contentsOf: result.exempt)
        }

        return (sensitive, exempt)
    }

    private func redactScreenshot(_ screenshot: UIImage, sensitiveFrames: [CGRect], maskColor: UIColor) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: screenshot.size)
        return renderer.image { context in
            screenshot.draw(at: .zero)
            maskColor.setFill()

            for frame in sensitiveFrames {
                context.cgContext.fill(frame)
            }
        }
    }

    private func typesToMask(for level: ScreenshotMaskLevel) -> [UIView.Type] {
        switch level {
        case .allTextAndMedia:
            return [
                UILabel.self,
                UITextView.self,
                UITextField.self,
                UIImageView.self,
                WKWebView.self,
                AVPlayerViewController().view.classForCoder
            ].compactMap { $0 as? UIView.Type }

        case .allText:
            return [
                UILabel.self,
                UITextView.self,
                UITextField.self
            ]

        case .allTextExceptClickable:
            return [
                UILabel.self,
                UITextView.self,
                UITextField.self
            ].filter { !$0.isSubclass(of: UIControl.self) }

        case .sensitiveFieldsOnly:
            return [
                UITextField.self
            ]
        }
    }
}
