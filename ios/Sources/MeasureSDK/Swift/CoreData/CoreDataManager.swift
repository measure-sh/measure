//
//  CoreDataManager.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import CoreData

protocol CoreDataManager {
    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void)
    func performMainTask(_ block: @escaping (NSManagedObjectContext) -> Void)
}

final class BaseCoreDataManager: CoreDataManager {
    private var persistentContainer: NSPersistentContainer?
    private var backgroundContext: NSManagedObjectContext?
    private var mainContext: NSManagedObjectContext?
    private let logger: Logger
    private var isReady: Bool = false {
        didSet {
            if isReady {
                flushQueuedTasks()
            }
        }
    }

    private var backgroundTaskQueue: [(NSManagedObjectContext) -> Void] = []
    private var mainTaskQueue: [(NSManagedObjectContext) -> Void] = []
    private let taskQueueLock = DispatchQueue(label: "com.measure.coredata.taskQueueLock", qos: .userInitiated)

    init(logger: Logger) {
        self.logger = logger

        #if SWIFT_PACKAGE
        guard let modelURL = Bundle.module.url(forResource: "MeasureModel", withExtension: "momd"),
              let model = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Error loading model from Swift Package bundle", error: nil, data: nil)
            return
        }
        #else
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

        persistentContainer?.loadPersistentStores(completionHandler: { (_, error) in
            if let error = error as NSError? {
                self.logger.log(level: .fatal, message: "Unresolved error loading persistent stores: \(error.localizedDescription), \(error.userInfo)", error: nil, data: nil)
            } else {
                self.mainContext = self.persistentContainer?.viewContext
                self.backgroundContext = self.persistentContainer?.newBackgroundContext()
                self.backgroundContext?.automaticallyMergesChangesFromParent = true
                self.isReady = true
                self.logger.log(level: .info, message: "Core Data persistent store loaded successfully.", error: nil, data: nil)
            }
        })
    }

    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        taskQueueLock.sync {
            if isReady, let context = backgroundContext {
                context.perform {
                    block(context)
                }
            } else {
                logger.log(level: .info, message: "Queuing background task since Core Data is not ready yet.", error: nil, data: nil)
                backgroundTaskQueue.append(block)
            }
        }
    }

    func performMainTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        taskQueueLock.sync {
            if isReady, let context = mainContext {
                context.perform {
                    block(context)
                }
            } else {
                logger.log(level: .info, message: "Queuing main task since Core Data is not ready yet.", error: nil, data: nil)
                mainTaskQueue.append(block)
            }
        }
    }

    private func flushQueuedTasks() {
        taskQueueLock.sync {
            if let backgroundContext = self.backgroundContext {
                for block in backgroundTaskQueue {
                    backgroundContext.perform {
                        block(backgroundContext)
                    }
                }
                backgroundTaskQueue.removeAll()
            }

            if let mainContext = self.mainContext {
                for block in mainTaskQueue {
                    mainContext.perform {
                        block(mainContext)
                    }
                }
                mainTaskQueue.removeAll()
            }
        }
    }
}
