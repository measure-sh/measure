//
//  EventOb+CoreDataProperties.swift
//  Measure
//
//  Created by Adwin Ross on 07/10/25.
//
//

import Foundation
import CoreData


typealias EventObCoreDataPropertiesSet = NSSet

extension EventOb {

    @nonobjc class func fetchRequest() -> NSFetchRequest<EventOb> {
        return NSFetchRequest<EventOb>(entityName: "EventOb")
    }

    @NSManaged var attributes: Data?
    @NSManaged var batchId: String?
    @NSManaged var bugReport: Data?
    @NSManaged var coldLaunch: Data?
    @NSManaged var cpuUsage: Data?
    @NSManaged var customEvent: Data?
    @NSManaged var exception: Data?
    @NSManaged var gestureClick: Data?
    @NSManaged var gestureLongClick: Data?
    @NSManaged var gestureScroll: Data?
    @NSManaged var hotLaunch: Data?
    @NSManaged var http: Data?
    @NSManaged var id: String?
    @NSManaged var lifecycleApp: Data?
    @NSManaged var lifecycleSwiftUI: Data?
    @NSManaged var lifecycleViewController: Data?
    @NSManaged var memoryUsage: Data?
    @NSManaged var needsReporting: Bool
    @NSManaged var networkChange: Data?
    @NSManaged var screenView: Data?
    @NSManaged var sessionId: String?
    @NSManaged var timestamp: String?
    @NSManaged var timestampInMillis: Int64
    @NSManaged var type: String?
    @NSManaged var userDefinedAttributes: String?
    @NSManaged var userTriggered: Bool
    @NSManaged var warmLaunch: Data?
    @NSManaged var attachmentsRel: NSSet?

}

// MARK: Generated accessors for attachmentsRel
extension EventOb {

    @objc(addAttachmentsRelObject:)
    @NSManaged public func addToAttachmentsRel(_ value: AttachmentOb)

    @objc(removeAttachmentsRelObject:)
    @NSManaged public func removeFromAttachmentsRel(_ value: AttachmentOb)

    @objc(addAttachmentsRel:)
    @NSManaged public func addToAttachmentsRel(_ values: NSSet)

    @objc(removeAttachmentsRel:)
    @NSManaged public func removeFromAttachmentsRel(_ values: NSSet)

}
