//
//  MockCoreDataManager.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/09/24.
//

import CoreData
import Foundation
@testable import MeasureSDK

final class MockCoreDataManager: CoreDataManager {
    var backgroundContext: NSManagedObjectContext
    var mainContext: NSManagedObjectContext

    init() {
        guard let modelURL = Bundle(for: type(of: self)).url(forResource: "MeasureModel", withExtension: "momd") else {
            fatalError("Error loading model from bundle")
        }

        guard let managedObjectModel = NSManagedObjectModel(contentsOf: modelURL) else {
            fatalError("Error initializing mom from: \(modelURL)")
        }

        let persistentContainer = NSPersistentContainer(name: "MeasureModel", managedObjectModel: managedObjectModel)

        let description = NSPersistentStoreDescription()
        description.type = NSInMemoryStoreType
        persistentContainer.persistentStoreDescriptions = [description]
        persistentContainer.loadPersistentStores { _, error in
            if let error = error {
                fatalError("Failed to load in-memory store: \(error)")
            }
        }
        mainContext = persistentContainer.viewContext
        backgroundContext = persistentContainer.newBackgroundContext()
    }
}
