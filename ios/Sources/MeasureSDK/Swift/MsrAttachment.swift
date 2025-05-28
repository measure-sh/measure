//
//  MsrAttachment.swift
//  Measure
//
//  Created by Adwin Ross on 08/05/25.
//

import Foundation

/// An attachment which can be added to an event. Represents a file that provides additional context
/// or evidence for the reported issue.
/// - Parameters:
///   - name: The display name of the attachment, typically including the file extension.
///   - bytes: The raw data of the attachment.
///   - type: The type of attachment, typically one of `AttachmentType`.
public class MsrAttachment: NSObject {
    let name: String
    let bytes: Data
    let type: AttachmentType

    init(name: String, bytes: Data, type: AttachmentType) {
        self.name = name
        self.bytes = bytes
        self.type = type
    }
}

extension MsrAttachment {
    func toEventAttachment(id: String) -> Attachment {
        return Attachment(name: self.name,
                          type: self.type,
                          size: Int64(self.bytes.count),
                          id: id,
                          bytes: self.bytes,
                          path: nil)
    }
}
