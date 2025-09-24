//
//  AttachmentsConverter.swift
//  Pods
//
//  Created by Abhay Sood on 26/06/25.
//
import Foundation
import Measure

class AttachmentsConverter {

    // Static method to convert JSON string to array of MsrAttachment objects
    static func convertAttachments(_ json: String?) throws -> [MsrAttachment] {
        // Return empty array if json is nil
        guard let json = json else {
            return []
        }

        var attachments: [MsrAttachment] = []
        // Convert JSON string to Data
        guard let jsonData = json.data(using: .utf8) else {
            fatalError("Invalid attachments format: Unable to convert string to data")
        }

        // Parse JSON data into array
        guard let jsonArray = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [[String: Any]] else {
            fatalError("Invalid attachments format: JSON is not an array of objects")
        }

        // Process each object in the array
        for jsonObject in jsonArray {
            guard let name = jsonObject["name"] as? String else {
                fatalError("Invalid attachments format: Missing required field 'name'")
            }

            guard let path = jsonObject["path"] as? String else {
                fatalError("Invalid attachments format: Missing required field 'path'")
            }

            guard let size = jsonObject["size"] as? Int64 else {
                fatalError("Invalid attachments format: Missing required field 'size'")
            }

            guard let id = jsonObject["id"] as? String else {
                fatalError("Invalid attachments format: Missing required field 'id'")
            }

            guard let type = jsonObject["type"] as? String else {
                fatalError("Invalid attachments format: Missing required field 'type'")
            }

            guard let attachmentType = AttachmentType(rawValue: type) else {
                fatalError("Invalid attachment type: \(type)")
            }

            let attachment = MsrAttachment(name: name, type: attachmentType, size: size, id: id, bytes: nil, path: path)
            attachments.append(attachment)
        }

        return attachments
    }
}
