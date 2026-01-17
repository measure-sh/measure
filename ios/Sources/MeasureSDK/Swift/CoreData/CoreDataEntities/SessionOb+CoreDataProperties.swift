//
//  SessionOb+CoreDataProperties.swift
//  Measure
//
//  Created by Adwin Ross on 15/01/26.
//
//

public import Foundation
public import CoreData


public typealias SessionObCoreDataPropertiesSet = NSSet

extension SessionOb {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<SessionOb> {
        return NSFetchRequest<SessionOb>(entityName: "SessionOb")
    }

    @NSManaged public var crashed: Bool
    @NSManaged public var createdAt: Int64
    @NSManaged public var needsReporting: Bool
    @NSManaged public var pid: Int32
    @NSManaged public var sessionId: String?
    @NSManaged public var isPriority: Bool

}
