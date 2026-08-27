//
//  MockScreenshotGenerator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 29/01/25.
//

import UIKit
@testable import Measure

final class MockScreenshotGenerator: ScreenshotGenerator {
    var attachment: MsrAttachment?
    var redactedImage: UIImage?

    func generate(window: UIWindow, // swiftlint:disable:this function_parameter_count
                  name: String,
                  storageType: AttachmentStorageType,
                  sync: Bool,
                  onRedactedImage: ((UIImage) -> Void)?,
                  completion: @escaping (MsrAttachment?) -> Void) {
        if let redactedImage = redactedImage {
            onRedactedImage?(redactedImage)
        }
        completion(attachment)
    }

    func generate(viewController: UIViewController, completion: @escaping (MsrAttachment?) -> Void) {
        completion(attachment)
    }
}
