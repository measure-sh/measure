//
//  SpanOb+CoreDataProperties.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 15/04/25.
//
//

import Foundation
import CoreData

extension SpanOb {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<SpanOb> {
        return NSFetchRequest<SpanOb>(entityName: "SpanOb")
    }

    @NSManaged public var attributes: Data?
    @NSManaged public var checkpoints: Data?
    @NSManaged public var duration: Int64
    @NSManaged public var endTime: Int64
    @NSManaged public var hasEnded: Bool
    @NSManaged public var isSampled: Bool
    @NSManaged public var name: String?
    @NSManaged public var parentId: String?
    @NSManaged public var sessionId: String?
    @NSManaged public var spanId: String?
    @NSManaged public var startTime: Int64
    @NSManaged public var status: Int64
    @NSManaged public var traceId: String?
    @NSManaged public var userDefinedAttrs: String?
    @NSManaged public var batchId: String?

}
