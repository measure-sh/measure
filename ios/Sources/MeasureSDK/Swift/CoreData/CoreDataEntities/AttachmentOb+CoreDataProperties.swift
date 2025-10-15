//
//  AttachmentOb+CoreDataProperties.swift
//  Measure
//
//  Created by Adwin Ross on 13/10/25.
//
//

import Foundation
import CoreData


typealias AttachmentObCoreDataPropertiesSet = NSSet

extension AttachmentOb {

    @nonobjc class func fetchRequest() -> NSFetchRequest<AttachmentOb> {
        return NSFetchRequest<AttachmentOb>(entityName: "AttachmentOb")
    }

    @NSManaged var attachmentSize: Int64
    @NSManaged var bytes: Data?
    @NSManaged var expires_at: String?
    @NSManaged var headers: Data?
    @NSManaged var id: String?
    @NSManaged var name: String?
    @NSManaged var path: String?
    @NSManaged var sessionId: String?
    @NSManaged var type: String?
    @NSManaged var uploadUrl: String?
    @NSManaged var eventRel: EventOb?

}
