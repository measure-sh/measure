//
//  BatchStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation
import CoreData

protocol BatchStore {
    func insertBatch(_ batch: BatchEntity) async -> Bool
    func getBatches(_ maxNumberOfBatches: Int) async -> [BatchEntity]
    func deleteBatch(_ batchId: String) async
}

final class BaseBatchStore: BatchStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertBatch(_ batch: BatchEntity) async -> Bool {
        await coreDataManager.performBackgroundTask { context in
            let batchOb = BatchOb(context: context)
            batchOb.batchId = batch.batchId
            batchOb.eventId = batch.eventIds.joined(separator: ",")
            batchOb.spanIds = batch.spanIds.joined(separator: ",")
            batchOb.createdAt = batch.createdAt

            do {
                try context.saveIfNeeded()
                return true
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to save batch \(batch.batchId)", error: error, data: nil)
                return false
            }
        } ?? false
    }

    func getBatches(_ maxNumberOfBatches: Int) async -> [BatchEntity] {
        await coreDataManager.performBackgroundTask { context in
            let request: NSFetchRequest<BatchOb> = BatchOb.fetchRequest()
            request.fetchLimit = maxNumberOfBatches
            request.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]

            do {
                let fetched = try context.fetch(request)
                return fetched.compactMap { batchOb in
                    guard let batchId = batchOb.batchId else { return nil }
                    let eventIds = batchOb.eventId?.components(separatedBy: ",") ?? []
                    let spanIds = batchOb.spanIds?.components(separatedBy: ",") ?? []
                    return BatchEntity(batchId: batchId, eventIds: eventIds, spanIds: spanIds, createdAt: batchOb.createdAt)
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch batches", error: error, data: nil)
                return []
            }
        } ?? []
    }

    func deleteBatch(_ batchId: String) async {
        await coreDataManager.performBackgroundTask { context in
            let request: NSFetchRequest<BatchOb> = BatchOb.fetchRequest()
            request.predicate = NSPredicate(format: "batchId == %@", batchId)

            do {
                let matches = try context.fetch(request)
                for item in matches {
                    context.delete(item)
                }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete batch: \(batchId)", error: error, data: nil)
            }
        }
    }
}
