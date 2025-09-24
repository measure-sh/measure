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
                let sensitiveFrames = self.findSensitiveFrames(in: window, rootView: window, types: typesToMask)

                let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
                let screenshot = renderer.image { _ in
                    window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
                }

                guard let redactedImage = self.redactScreenshot(screenshot, sensitiveFrames: sensitiveFrames, maskColor: self.maskColor) else {
                    completion(nil)
                    return
                }

                guard let compressedData = redactedImage.jpegData(compressionQuality: CGFloat(self.configProvider.screenshotCompressionQuality) / 100.0) else {
                    self.logger.log(level: .debug, message: "ScreenshotGenerator: Failed to compress image.", error: nil, data: nil)
                    completion(nil)
                    return
                }

                let attachment = self.attachmentProcessor.getAttachmentObject(
                    for: compressedData,
                    name: name,
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

    private func findSensitiveFrames(in view: UIView, rootView: UIView, types: [UIView.Type]) -> [CGRect] {
        var sensitiveFrames: [CGRect] = []

        for type in types {
            if view.isKind(of: type) {
                let frameInRootView = view.convert(view.bounds, to: rootView)
                sensitiveFrames.append(frameInRootView)
                break
            }
        }

        for subview in view.subviews {
            sensitiveFrames.append(contentsOf: findSensitiveFrames(in: subview, rootView: rootView, types: types))
        }

        return sensitiveFrames
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
