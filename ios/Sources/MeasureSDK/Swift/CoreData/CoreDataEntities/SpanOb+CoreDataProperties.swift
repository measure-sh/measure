//
//  SpanOb+CoreDataProperties.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/04/25.
//
//

import Foundation
import CoreData

extension SpanOb {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<SpanOb> {
        return NSFetchRequest<SpanOb>(entityName: "SpanOb")
    }

    @NSManaged var attributes: Data?
    @NSManaged var batchId: String?
    @NSManaged var checkpoints: Data?
    @NSManaged var duration: Int64
    @NSManaged var endTime: Int64
    @NSManaged var hasEnded: Bool
    @NSManaged var isSampled: Bool
    @NSManaged var name: String?
    @NSManaged var parentId: String?
    @NSManaged var sessionId: String?
    @NSManaged var spanId: String
    @NSManaged var startTime: Int64
    @NSManaged var status: Int64
    @NSManaged var traceId: String?
    @NSManaged var userDefinedAttrs: Data?
    @NSManaged var startTimeString: String
    @NSManaged var endTimeString: String
}
