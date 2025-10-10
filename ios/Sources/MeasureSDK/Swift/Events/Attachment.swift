//
//  Attachment.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/09/24.
//

import Foundation

public class MsrAttachment: NSObject, Codable {
    /// The name of the attachment, e.g. "screenshot.png".
    public let name: String

    /// The type of the attachment.
    public let type: AttachmentType

    /// An optional byte array representing the attachment (not encoded).
    public var bytes: Data?

    /// An optional path to the attachment (not encoded).
    public var path: String?

    /// Size of the attachment in bytes
    public var size: Int64

    /// A unique id for the image
    public var id: String

    public init(name: String,
                type: AttachmentType,
                size: Int64,
                id: String,
                bytes: Data? = nil,
                path: String? = nil) {
        precondition(bytes != nil || path != nil, "Failed to create Attachment. Either bytes or path must be provided")
        precondition(bytes == nil || path == nil, "Failed to create Attachment. Only one of bytes or path must be provided")

        self.name = name
        self.type = type
        self.bytes = bytes
        self.path = path
        self.size = size
        self.id = id
    }
}

struct MsrUploadAttachment {
    let id: String
    let name: String
    let type: AttachmentType
    let size: Number
    let bytes: Data?
    let path: String?
    let uploadUrl: String
    let expiresAt: String?
    let headers: Data?
}
