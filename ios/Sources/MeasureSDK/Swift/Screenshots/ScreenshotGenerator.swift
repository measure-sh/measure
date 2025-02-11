//
//  ScreenshotGenerator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/01/25.
//

import UIKit

protocol ScreenshotGenerator {
    func generate(window: UIWindow, name: String, storageType: AttachmentStorageType) -> Attachment?
}

final class BaseScreenshotGenerator: ScreenshotGenerator {
    private let configProvider: ConfigProvider
    private let maskColor: UIColor
    private let logger: Logger
    private let attachmentProcessor: AttachmentProcessor
    private let userPermissionManager: UserPermissionManager

    init(configProvider: ConfigProvider, logger: Logger, attachmentProcessor: AttachmentProcessor, userPermissionManager: UserPermissionManager) {
        self.configProvider = configProvider
        self.maskColor = UIColor(hex: configProvider.screenshotMaskHexColor) ?? .black
        self.logger = logger
        self.attachmentProcessor = attachmentProcessor
        self.userPermissionManager = userPermissionManager
    }

    func generate(window: UIWindow, name: String, storageType: AttachmentStorageType) -> Attachment? {
        guard userPermissionManager.isPhotoLibraryUsagePermissionAvailable() else {
            logger.log(level: .debug, message: "Photos permission not available.", error: nil, data: nil)
            return nil
        }
        let sensitiveFrames = findSensitiveFrames(in: window, rootView: window, types: [UITextView.self, UILabel.self, UIImageView.self])

        let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
        let screenshot = renderer.image { context in
            window.layer.render(in: context.cgContext)
        }

        guard let redactedImage = redactScreenshot(screenshot, sensitiveFrames: sensitiveFrames, maskColor: self.maskColor) else {
            return nil
        }

        guard let compressedData = redactedImage.jpegData(compressionQuality: CGFloat(configProvider.screenshotCompressionQuality) / 100.0) else {
            logger.log(level: .debug, message: "ScreenshotGenerator: Failed to compress image.", error: nil, data: nil)
            return nil
        }

        return attachmentProcessor.getAttachmentObject(for: compressedData, name: name, storageType: storageType, attachmentType: .screenshot)
    }

    private func findSensitiveFrames(in view: UIView, rootView: UIView, types: [UIView.Type]) -> [CGRect] {
        var sensitiveFrames: [CGRect] = []

        // Check if the current view is of a sensitive type
        if types.contains(where: { view.isKind(of: $0) }) {
            let frameInRootView = view.convert(view.bounds, to: rootView)
            sensitiveFrames.append(frameInRootView)
        }

        // Recursively search subviews
        for subview in view.subviews {
            sensitiveFrames.append(contentsOf: findSensitiveFrames(in: subview, rootView: rootView, types: types))
        }

        return sensitiveFrames
    }

    private func redactScreenshot(_ screenshot: UIImage, sensitiveFrames: [CGRect], maskColor: UIColor) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: screenshot.size)
        return renderer.image { context in
            // Draw the original screenshot
            screenshot.draw(at: .zero)
            maskColor.setFill()

            // Draw black boxes over sensitive areas
            for frame in sensitiveFrames {
                context.cgContext.fill(frame)
            }
        }
    }
}
