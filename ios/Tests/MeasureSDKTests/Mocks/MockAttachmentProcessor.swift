//
//  MockAttachmentProcessor.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 18/03/26.
//

import Foundation
@testable import Measure

final class MockAttachmentProcessor: AttachmentProcessor {
    var capturedData: Data?
    var capturedStorageType: AttachmentStorageType?
    var capturedAttachmentType: AttachmentType?
    var capturedNode: SnapshotNode?
    var attachment: MsrAttachment?

    func getAttachmentObject(for image: Data, storageType: AttachmentStorageType, attachmentType: AttachmentType) -> MsrAttachment? {
        capturedData = image
        capturedStorageType = storageType
        capturedAttachmentType = attachmentType

        if let jsonString = String(data: image, encoding: .utf8),
           let jsonData = jsonString.data(using: .utf8) {
            capturedNode = try? JSONDecoder().decode(SnapshotNode.self, from: jsonData)
        }
        return attachment
    }
}
