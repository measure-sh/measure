//
//  BatchStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation
import CoreData

protocol BatchStore {
    func insertBatch(_ batch: BatchEntity) -> Bool
    func getBatches(_ maxNumberOfBatches: Int) -> [BatchEntity]
    func deleteBatch(_ batchId: String)
}

final class BaseBatchStore: BatchStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertBatch(_ batch: BatchEntity) -> Bool {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return false
        }
        var insertionSuccessful = false

        context.performAndWait { [weak self] in
            let batchOb = BatchOb(context: context)
            batchOb.batchId = batch.batchId
            batchOb.createdAt = batch.createdAt
            batchOb.eventId = batch.eventIds.joined(separator: ",") // Convert array to comma-separated string

            do {
                try context.saveIfNeeded()
                insertionSuccessful = true
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to save batch: \(batch.batchId)", error: error, data: nil)
            }
        }

        return insertionSuccessful
    }

    func getBatches(_ maxNumberOfBatches: Int) -> [BatchEntity] {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return [BatchEntity]()
        }
        let fetchRequest: NSFetchRequest<BatchOb> = BatchOb.fetchRequest()
        fetchRequest.fetchLimit = maxNumberOfBatches

        var batches: [BatchEntity] = []
        context.performAndWait { [weak self] in
            do {
                let results = try context.fetch(fetchRequest)
                for batchOb in results {
                    if let batchId = batchOb.batchId, let eventIdsString = batchOb.eventId {
                        let eventIds = eventIdsString.components(separatedBy: ",") // Convert back to array
                        let batch = BatchEntity(batchId: batchId,
                                                eventIds: eventIds,
                                                createdAt: batchOb.createdAt)
                        batches.append(batch)
                    }
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to fetch batches", error: error, data: nil)
            }
        }

        return batches
    }

    func deleteBatch(_ batchId: String) {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return
        }
        let fetchRequest: NSFetchRequest<BatchOb> = BatchOb.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "batchId == %@", batchId)
        fetchRequest.fetchLimit = 1

        context.performAndWait { [weak self] in
            do {
                if let batchToDelete = try context.fetch(fetchRequest).first {
                    context.delete(batchToDelete)
                    try context.saveIfNeeded()
                    self?.logger.internalLog(level: .debug, message: "Successfully deleted batch with id: \(batchId)", error: nil, data: nil)
                } else {
                    self?.logger.internalLog(level: .warning, message: "No batch found with id: \(batchId)", error: nil, data: nil)
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to delete batch with id: \(batchId)", error: error, data: nil)
            }
        }
    }

}
