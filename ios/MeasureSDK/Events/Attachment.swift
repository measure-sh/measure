//
//  Attachment.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/09/24.
//

import Foundation

struct Attachment: Codable {
    /// The name of the attachment, e.g. "screenshot.png".
    let name: String

    /// The type of the attachment.
    let type: AttachmentType

    /// An optional byte array representing the attachment (not encoded).
    var bytes: Data?

    /// An optional path to the attachment (not encoded).
    var path: String?

    init(name: String,
         type: AttachmentType,
         bytes: Data? = nil,
         path: String? = nil) {
        precondition(bytes != nil || path != nil, "Failed to create Attachment. Either bytes or path must be provided")
        precondition(bytes == nil || path == nil, "Failed to create Attachment. Only one of bytes or path must be provided")

        self.name = name
        self.type = type
        self.bytes = bytes
        self.path = path
    }
}
