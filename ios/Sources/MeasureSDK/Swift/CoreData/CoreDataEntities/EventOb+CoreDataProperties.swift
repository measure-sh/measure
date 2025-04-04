//
//  EventOb+CoreDataProperties.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/03/25.
//
//

import Foundation
import CoreData

extension EventOb {

    @nonobjc class func fetchRequest() -> NSFetchRequest<EventOb> {
        return NSFetchRequest<EventOb>(entityName: "EventOb")
    }

    @NSManaged var attachments: Data?
    @NSManaged var attachmentSize: Int64
    @NSManaged var attributes: Data?
    @NSManaged var batchId: String?
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

}
