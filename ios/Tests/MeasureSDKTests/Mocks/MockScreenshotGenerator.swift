//
//  MockScreenshotGenerator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 29/01/25.
//

import UIKit
@testable import Measure

final class MockScreenshotGenerator: ScreenshotGenerator {
    var attachment: Attachment?

    func generate(window: UIWindow, name: String, storageType: AttachmentStorageType) -> Attachment? {
        return attachment
    }
}
