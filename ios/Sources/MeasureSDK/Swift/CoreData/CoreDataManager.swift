//
//  CoreDataManager.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import CoreData

protocol CoreDataManager {
    var mainContext: NSManagedObjectContext? { get }
    var backgroundContext: NSManagedObjectContext? { get }
}

final class BaseCoreDataManager: CoreDataManager {
    private var persistentContainer: NSPersistentContainer?

    var backgroundContext: NSManagedObjectContext?
    var mainContext: NSManagedObjectContext?
    let logger: Logger

    init(logger: Logger) {
        self.logger = logger
        #if SWIFT_PACKAGE
        // Use `Bundle.module` for Swift Package Manager
        guard let modelURL = Bundle.module.url(forResource: "MeasureModel", withExtension: "momd"),
              let model = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Error loading model from Swift Package bundle", error: nil, data: nil)
        }
        #else
        // Use `Bundle(for:)` for CocoaPods or direct integration
        guard let modelURL = Bundle(for: type(of: self)).url(forResource: "MeasureModel", withExtension: "momd") else {
            logger.log(level: .fatal, message: "Error loading model from bundle", error: nil, data: nil)
            return
        }
        #endif

        guard let managedObjectModel = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Error initializing mom from: \(modelURL)", error: nil, data: nil)
            return
        }

        self.persistentContainer = NSPersistentContainer(name: "MeasureModel", managedObjectModel: managedObjectModel)
        if let persistentContainer = self.persistentContainer {
            persistentContainer.loadPersistentStores(completionHandler: { (_, error) in
                if let error = error as NSError? {
                    logger.log(level: .fatal, message: "Unresolved error \(error), \(error.userInfo)", error: nil, data: nil)
                }
            })
            self.mainContext = persistentContainer.viewContext
            self.backgroundContext = persistentContainer.newBackgroundContext()
            self.backgroundContext?.automaticallyMergesChangesFromParent = true
        }
    }
}
