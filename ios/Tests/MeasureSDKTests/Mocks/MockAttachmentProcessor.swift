//
//  MockAttachmentProcessor.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 29/01/25.
//

import Foundation
@testable import Measure

final class MockAttachmentProcessor: AttachmentProcessor {
    var attachmentObject: MsrAttachment?

    func getAttachmentObject(for image: Data, name: String, storageType: AttachmentStorageType, attachmentType: AttachmentType) -> MsrAttachment? {
        return attachmentObject
    }
}
