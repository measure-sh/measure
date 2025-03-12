//
//  CoreDataManager.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import CoreData

protocol CoreDataManager {
    var mainContext: NSManagedObjectContext { get }
    var backgroundContext: NSManagedObjectContext { get }
}

final class BaseCoreDataManager: CoreDataManager {
    private let persistentContainer: NSPersistentContainer

    let backgroundContext: NSManagedObjectContext
    let mainContext: NSManagedObjectContext

    public init() {
        #if SWIFT_PACKAGE
        // Use `Bundle.module` for Swift Package Manager
        guard let modelURL = Bundle.module.url(forResource: "MeasureModel", withExtension: "momd"),
              let model = NSManagedObjectModel(contentsOf: modelURL) else {
            fatalError("Error loading model from Swift Package bundle")
        }
        #else
        // Use `Bundle(for:)` for CocoaPods or direct integration
        guard let modelURL = Bundle(for: type(of: self)).url(forResource: "MeasureModel", withExtension: "momd") else {
                    fatalError("Error loading model from bundle")
                }
        #endif

        guard let managedObjectModel = NSManagedObjectModel(contentsOf: modelURL) else {
            fatalError("Error initializing mom from: \(modelURL)")
        }

        self.persistentContainer = NSPersistentContainer(name: "MeasureModel", managedObjectModel: managedObjectModel)
        self.persistentContainer.loadPersistentStores(completionHandler: { (_, error) in
            if let error = error as NSError? {
                fatalError("Unresolved error \(error), \(error.userInfo)")
            }
        })
        self.mainContext = self.persistentContainer.viewContext
        self.backgroundContext = self.persistentContainer.newBackgroundContext()
        self.backgroundContext.automaticallyMergesChangesFromParent = true
    }
}
