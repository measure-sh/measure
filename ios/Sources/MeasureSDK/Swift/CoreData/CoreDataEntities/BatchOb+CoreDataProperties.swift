//
//  BatchOb+CoreDataProperties.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 15/04/25.
//
//

import Foundation
import CoreData

extension BatchOb {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<BatchOb> {
        return NSFetchRequest<BatchOb>(entityName: "BatchOb")
    }

    @NSManaged public var batchId: String?
    @NSManaged public var createdAt: Int64
    @NSManaged public var eventId: String?
    @NSManaged public var spanIds: String?

}
