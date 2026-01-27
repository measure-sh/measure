//
//  CoreDataManager.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import CoreData

protocol CoreDataManager {
    var backgroundContext: NSManagedObjectContext? { get }
}

final class BaseCoreDataManager: CoreDataManager {
    private let logger: Logger
    private var persistentContainer: NSPersistentContainer?
    private var _backgroundContext: NSManagedObjectContext?
    private let readySemaphore = DispatchSemaphore(value: 0)
    private var initializationFailed = false
    private var didSignalReady = false
    private let readyLock = NSLock()

    init(logger: Logger) {
        self.logger = logger

        let model: NSManagedObjectModel

        #if SWIFT_PACKAGE
        guard let modelURL = Bundle.module.url(forResource: "MeasureModel", withExtension: "momd"),
              let loadedModel = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Failed to load Core Data model (SPM)", error: nil, data: nil)
            initializationFailed = true
            signalReadyOnce()
            return
        }
        model = loadedModel
        #else
        guard let modelURL = Bundle(for: type(of: self)).url(forResource: "MeasureModel", withExtension: "momd"),
              let loadedModel = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Failed to load Core Data model", error: nil, data: nil)
            initializationFailed = true
            signalReadyOnce()
            return
        }
        model = loadedModel
        #endif

        let container = NSPersistentContainer(name: "MeasureModel", managedObjectModel: model)
        self.persistentContainer = container

        container.loadPersistentStores { [weak self] _, error in
            guard let self else { return }

            if let error {
                self.logger.log(
                    level: .fatal,
                    message: "Unresolved error loading persistent stores: \(error.localizedDescription)",
                    error: error,
                    data: nil
                )
                self.initializationFailed = true
                self.signalReadyOnce()
                return
            }

            let backgroundContext = container.newBackgroundContext()
            backgroundContext.automaticallyMergesChangesFromParent = true
            backgroundContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy

            self._backgroundContext = backgroundContext

            self.logger.log(
                level: .info,
                message: "Core Data persistent store loaded successfully.",
                error: nil,
                data: nil
            )

            self.signalReadyOnce()
        }
    }

    var backgroundContext: NSManagedObjectContext? {
        if didSignalReady {
            return _backgroundContext
        }

        readySemaphore.wait()

        if initializationFailed {
            logger.log(
                level: .error,
                message: "Core Data unavailable due to failed initialization",
                error: nil,
                data: nil
            )
            return nil
        }

        return _backgroundContext
    }

    private func signalReadyOnce() {
        readyLock.lock()
        defer { readyLock.unlock() }

        guard !didSignalReady else { return }
        didSignalReady = true
        readySemaphore.signal()
    }
}
