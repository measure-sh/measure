//
//  MockAttachmentProcessor.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 29/01/25.
//

import Foundation
@testable import MeasureSDK

final class MockAttachmentProcessor: AttachmentProcessor {
    var attachmentObject: Attachment?

    func getAttachmentObject(for image: Data, name: String, storageType: MeasureSDK.AttachmentStorageType, attachmentType: MeasureSDK.AttachmentType) -> MeasureSDK.Attachment? {
        return attachmentObject
    }
}
