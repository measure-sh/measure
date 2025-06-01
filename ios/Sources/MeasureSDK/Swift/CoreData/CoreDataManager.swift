//
//  CoreDataManager.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import CoreData

protocol CoreDataManager {
    @discardableResult
    func performBackgroundTask<T>(_ block: @escaping (NSManagedObjectContext) async -> T?) async -> T?

    @discardableResult
    func performMainTask<T>(_ block: @escaping (NSManagedObjectContext) async -> T?) async -> T?
}

import CoreData

final class BaseCoreDataManager: CoreDataManager {
    private var persistentContainer: NSPersistentContainer?
    private var backgroundContext: NSManagedObjectContext?
    private var mainContext: NSManagedObjectContext?
    private let logger: Logger
    private var isReady: Bool = false

    private enum TaskType {
        case main
        case background
    }

    private struct QueuedTask {
        let type: TaskType
        let block: (NSManagedObjectContext) async -> Void
    }

    private var taskQueue: [QueuedTask] = []
    private let taskQueueLock = NSLock()

    init(logger: Logger) {
        self.logger = logger

        #if SWIFT_PACKAGE
        guard let modelURL = Bundle.module.url(forResource: "MeasureModel", withExtension: "momd"),
              let model = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Error loading model from Swift Package bundle", error: nil, data: nil)
            return
        }
        #else
        guard let modelURL = Bundle(for: type(of: self)).url(forResource: "MeasureModel", withExtension: "momd"),
              let model = NSManagedObjectModel(contentsOf: modelURL) else {
            logger.log(level: .fatal, message: "Error loading model from bundle", error: nil, data: nil)
            return
        }
        #endif

        self.persistentContainer = NSPersistentContainer(name: "MeasureModel", managedObjectModel: model)

        persistentContainer?.loadPersistentStores { [weak self] _, error in
            guard let self else { return }

            if let error {
                self.logger.log(level: .fatal, message: "Unresolved error loading persistent stores: \(error.localizedDescription)", error: nil, data: nil)
                return
            }

            self.mainContext = self.persistentContainer?.viewContext
            self.backgroundContext = self.persistentContainer?.newBackgroundContext()
            self.backgroundContext?.automaticallyMergesChangesFromParent = true
            self.isReady = true

            self.logger.log(level: .info, message: "Core Data persistent store loaded successfully.", error: nil, data: nil)

            self.flushQueuedTasks()
        }
    }

    // MARK: - Async Task Methods

    func performBackgroundTask<T>(_ block: @escaping (NSManagedObjectContext) async -> T?) async -> T? {
        await withCheckedContinuation { continuation in
            let task: (NSManagedObjectContext) async -> Void = { context in
                let result = await block(context)
                continuation.resume(returning: result)
            }

            taskQueueLock.lock()
            defer { taskQueueLock.unlock() }

            if isReady, let context = backgroundContext {
                context.perform {
                    Task { await task(context) }
                }
            } else {
                taskQueue.append(QueuedTask(type: .background, block: task))
            }
        }
    }

    func performMainTask<T>(_ block: @escaping (NSManagedObjectContext) async -> T?) async -> T? {
        await withCheckedContinuation { continuation in
            let task: (NSManagedObjectContext) async -> Void = { context in
                let result = await block(context)
                continuation.resume(returning: result)
            }

            taskQueueLock.lock()
            defer { taskQueueLock.unlock() }

            if isReady, let context = mainContext {
                context.perform {
                    Task { await task(context) }
                }
            } else {
                taskQueue.append(QueuedTask(type: .main, block: task))
            }
        }
    }

    // MARK: - Queue Flushing

    private func flushQueuedTasks() {
        taskQueueLock.lock()
        let tasks = taskQueue
        taskQueue.removeAll()
        taskQueueLock.unlock()

        for task in tasks {
            let context = task.type == .main ? mainContext : backgroundContext
            context?.perform {
                Task {
                    await task.block(context!)
                }
            }
        }
    }
}
