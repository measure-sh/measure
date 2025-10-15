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

    @nonobjc class func fetchRequest() -> NSFetchRequest<BatchOb> {
        return NSFetchRequest<BatchOb>(entityName: "BatchOb")
    }

    @NSManaged var batchId: String?
    @NSManaged var createdAt: Int64
    @NSManaged var eventId: String?
    @NSManaged var spanIds: String?

}
