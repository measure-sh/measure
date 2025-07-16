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
}

final class BaseCoreDataManager: CoreDataManager {
    private var persistentContainer: NSPersistentContainer?
    private var backgroundContext: NSManagedObjectContext?
    private var mainContext: NSManagedObjectContext?
    private let logger: Logger
    private var initializationFailed: Bool = false
    private var backgroundTaskQueue: [(NSManagedObjectContext) -> Void] = []
    private let taskQueueLock = DispatchQueue(label: "com.measure.coredata.taskQueueLock", qos: .userInitiated)
    private var isReady: Bool = false {
        didSet {
            if isReady {
                flushQueuedTasks()
            }
        }
    }

    init(logger: Logger) {
        self.logger = logger

        #if SWIFT_PACKAGE
        guard let modelURL = Bundle.module.url(forResource: "MeasureModel", withExtension: "momd"),
              let model = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Error loading model from Swift Package bundle", error: nil, data: nil)
            initializationFailed = true
            return
        }
        #else
        guard let modelURL = Bundle(for: type(of: self)).url(forResource: "MeasureModel", withExtension: "momd"),
              let model = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Error loading model from bundle or initializing model", error: nil, data: nil)
            initializationFailed = true
            return
        }
        #endif

        self.persistentContainer = NSPersistentContainer(name: "MeasureModel", managedObjectModel: model)

        persistentContainer?.loadPersistentStores { (_, error) in
            if let error = error {
                self.logger.log(
                    level: .fatal,
                    message: "Unresolved error loading persistent stores: \(error.localizedDescription)",
                    error: error,
                    data: nil
                )
                self.initializationFailed = true

                // Clear any queued tasks since they'll never run
                self.taskQueueLock.sync {
                    self.backgroundTaskQueue.removeAll()
                }
                return
            }

            self.mainContext = self.persistentContainer?.viewContext
            self.backgroundContext = self.persistentContainer?.newBackgroundContext()
            self.backgroundContext?.automaticallyMergesChangesFromParent = true
            self.isReady = true

            self.logger.log(level: .info, message: "Core Data persistent store loaded successfully.", error: nil, data: nil)
        }
    }

    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        taskQueueLock.sync {
            if initializationFailed {
                logger.log(level: .error, message: "Core Data is not available due to failed initialization. Task dropped.", error: nil, data: nil)
                return
            }

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

    private func flushQueuedTasks() {
        taskQueueLock.sync {
            guard let backgroundContext = self.backgroundContext else { return }

            logger.log(level: .info, message: "Flushing \(backgroundTaskQueue.count) queued Core Data tasks.", error: nil, data: nil)

            for task in backgroundTaskQueue {
                backgroundContext.perform {
                    task(backgroundContext)
                }
            }
            backgroundTaskQueue.removeAll()
        }
    }
}
