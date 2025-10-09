//
//  EventOb+CoreDataProperties.swift
//  Measure
//
//  Created by Adwin Ross on 07/10/25.
//
//

public import Foundation
public import CoreData


public typealias EventObCoreDataPropertiesSet = NSSet

extension EventOb {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<EventOb> {
        return NSFetchRequest<EventOb>(entityName: "EventOb")
    }

    @NSManaged public var attributes: Data?
    @NSManaged public var batchId: String?
    @NSManaged public var bugReport: Data?
    @NSManaged public var coldLaunch: Data?
    @NSManaged public var cpuUsage: Data?
    @NSManaged public var customEvent: Data?
    @NSManaged public var exception: Data?
    @NSManaged public var gestureClick: Data?
    @NSManaged public var gestureLongClick: Data?
    @NSManaged public var gestureScroll: Data?
    @NSManaged public var hotLaunch: Data?
    @NSManaged public var http: Data?
    @NSManaged public var id: String?
    @NSManaged public var lifecycleApp: Data?
    @NSManaged public var lifecycleSwiftUI: Data?
    @NSManaged public var lifecycleViewController: Data?
    @NSManaged public var memoryUsage: Data?
    @NSManaged public var needsReporting: Bool
    @NSManaged public var networkChange: Data?
    @NSManaged public var screenView: Data?
    @NSManaged public var sessionId: String?
    @NSManaged public var timestamp: String?
    @NSManaged public var timestampInMillis: Int64
    @NSManaged public var type: String?
    @NSManaged public var userDefinedAttributes: String?
    @NSManaged public var userTriggered: Bool
    @NSManaged public var warmLaunch: Data?
    @NSManaged public var attachmentsRel: NSSet?

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
