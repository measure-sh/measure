//
//  BatchOb+CoreDataProperties.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/03/25.
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

}
