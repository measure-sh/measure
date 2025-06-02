//
//  MockCoreDataManager.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/09/24.
//

import CoreData
import Foundation
@testable import Measure

final class MockCoreDataManager: CoreDataManager {
    var backgroundContext: NSManagedObjectContext?
    var mainContext: NSManagedObjectContext?
    private let persistentContainer: NSPersistentContainer

    init() {
        guard let modelURL = Bundle(for: type(of: self)).url(forResource: "MeasureModel", withExtension: "momd") else {
            fatalError("Error loading model from bundle")
        }

        guard let managedObjectModel = NSManagedObjectModel(contentsOf: modelURL) else {
            fatalError("Error initializing NSManagedObjectModel from: \(modelURL)")
        }

        persistentContainer = NSPersistentContainer(name: "MeasureModel", managedObjectModel: managedObjectModel)
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

    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        guard let context = backgroundContext else { return }
        context.perform {
            block(context)
        }
    }

    func performMainTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        guard let context = mainContext else { return }
        context.perform {
            block(context)
        }
    }
}
