//
//  CoreDataManager.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import CoreData

final class CoreDataManager {
    static let shared = CoreDataManager()

    private let persistentContainer: NSPersistentContainer
    private lazy var mainContext: NSManagedObjectContext = {
        let context = persistentContainer.viewContext
        context.mergePolicy = NSMergePolicy(merge: .mergeByPropertyStoreTrumpMergePolicyType)
        return context
    }()

    private init() {
        guard let modelURL = Bundle(for: type(of: self)).url(forResource: "MeasureModel", withExtension: "momd") else {
            fatalError("Error loading model from bundle")
        }

        guard let managedObjectModel = NSManagedObjectModel(contentsOf: modelURL) else {
            fatalError("Error initializing mom from: \(modelURL)")
        }
        persistentContainer = NSPersistentContainer(name: "MeasureModel", managedObjectModel: managedObjectModel)
        persistentContainer.loadPersistentStores(completionHandler: { (_, error) in
            if let error = error as NSError? {
                fatalError("Unresolved error \(error), \(error.userInfo)")
            }
        })
    }

    // MARK: - Private Context Creation

    private func newBackgroundContext() -> NSManagedObjectContext {
        let context = persistentContainer.newBackgroundContext()
        context.mergePolicy = NSMergePolicy(merge: .mergeByPropertyObjectTrumpMergePolicyType)
        return context
    }
}
