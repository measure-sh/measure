//
//  EventToAttachmentMigrationPolicy.swift
//  Measure
//
//  Created by Adwin Ross on 07/10/25.
//

import CoreData
import Foundation

class EventToAttachmentMigrationPolicy: NSEntityMigrationPolicy {
    override func createDestinationInstances(forSource sInstance: NSManagedObject,
                                             in mapping: NSEntityMapping,
                                             manager: NSMigrationManager) throws {
        let dInstance = NSEntityDescription.insertNewObject(forEntityName: mapping.destinationEntityName!,
                                                            into: manager.destinationContext)

        for (key, _) in sInstance.entity.attributesByName {
            if key != "attachments" && key != "attachmentSize" {
                dInstance.setValue(sInstance.value(forKey: key), forKey: key)
            }
        }

        if let attachmentsData = sInstance.value(forKey: "attachments") as? Data {
            let decoder = JSONDecoder()
            let msrAttachments: [MsrAttachment]
            
            do {
                msrAttachments = try decoder.decode([MsrAttachment].self, from: attachmentsData)
            } catch {
                print("Migration Error: Failed to decode MsrAttachments for Event ID \(sInstance.value(forKey: "id") ?? "unknown"). Error: \(error)")
                msrAttachments = []
            }

            for attachment in msrAttachments {
                let dAttachment = NSEntityDescription.insertNewObject(forEntityName: "AttachmentOb",
                                                                      into: manager.destinationContext)
                dAttachment.setValue(attachment.name, forKey: "name")
                dAttachment.setValue(attachment.type.rawValue, forKey: "type")
                dAttachment.setValue(attachment.bytes, forKey: "bytes")
                dAttachment.setValue(attachment.id, forKey: "id")
                dAttachment.setValue(attachment.size, forKey: "attachmentSize")
                dAttachment.setValue(attachment.path, forKey: "path")
                dAttachment.setValue(nil, forKey: "uploadUrl")
                dAttachment.setValue(dInstance, forKey: "eventRel")
            }
        }

        manager.associate(sourceInstance: sInstance, withDestinationInstance: dInstance, for: mapping)
    }
}
