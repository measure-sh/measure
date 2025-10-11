//
//  AttachmentOb+CoreDataProperties.swift
//  Measure
//
//  Created by Adwin Ross on 09/10/25.
//
//

public import Foundation
public import CoreData


public typealias AttachmentObCoreDataPropertiesSet = NSSet

extension AttachmentOb {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<AttachmentOb> {
        return NSFetchRequest<AttachmentOb>(entityName: "AttachmentOb")
    }

    @NSManaged public var attachmentSize: Int64
    @NSManaged public var bytes: Data?
    @NSManaged public var expires_at: String?
    @NSManaged public var headers: Data?
    @NSManaged public var id: String?
    @NSManaged public var name: String?
    @NSManaged public var path: String?
    @NSManaged public var type: String?
    @NSManaged public var uploadUrl: String?
    @NSManaged var eventRel: EventOb?

}
