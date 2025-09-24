//
//  SessionOb+CoreDataProperties.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/03/25.
//
//

import Foundation
import CoreData

extension SessionOb {

    @nonobjc class func fetchRequest() -> NSFetchRequest<SessionOb> {
        return NSFetchRequest<SessionOb>(entityName: "SessionOb")
    }

    @NSManaged var crashed: Bool
    @NSManaged var createdAt: Int64
    @NSManaged var needsReporting: Bool
    @NSManaged var pid: Int32
    @NSManaged var sessionId: String?

}
