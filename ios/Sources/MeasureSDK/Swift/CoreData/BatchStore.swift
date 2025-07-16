//
//  BatchStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation
import CoreData

protocol BatchStore {
    func insertBatch(_ batch: BatchEntity, completion: @escaping (Bool) -> Void)
    func getBatches(_ maxNumberOfBatches: Int, completion: @escaping ([BatchEntity]) -> Void)
    func deleteBatch(_ batchId: String, completion: @escaping () -> Void)
}

final class BaseBatchStore: BatchStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertBatch(_ batch: BatchEntity, completion: @escaping (Bool) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self = self else {
                completion(false)
                return
            }

            let batchOb = BatchOb(context: context)
            batchOb.batchId = batch.batchId
            batchOb.createdAt = batch.createdAt
            batchOb.eventId = batch.eventIds.joined(separator: ",")
            batchOb.spanIds = batch.spanIds.joined(separator: ",")

            do {
                try context.saveIfNeeded()
                completion(true)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to save batch: \(batch.batchId)", error: error, data: nil)
                completion(false)
            }
        }
    }

    func getBatches(_ maxNumberOfBatches: Int, completion: @escaping ([BatchEntity]) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self = self else {
                completion([])
                return
            }

            let fetchRequest: NSFetchRequest<BatchOb> = BatchOb.fetchRequest()
            fetchRequest.fetchLimit = maxNumberOfBatches

            do {
                let results = try context.fetch(fetchRequest)
                let batches = results.compactMap { batchOb -> BatchEntity? in
                    guard let batchId = batchOb.batchId else { return nil }
                    let eventIds = batchOb.eventId?.components(separatedBy: ",") ?? []
                    let spanIds = batchOb.spanIds?.components(separatedBy: ",") ?? []

                    return BatchEntity(batchId: batchId,
                                       eventIds: eventIds,
                                       spanIds: spanIds,
                                       createdAt: batchOb.createdAt)
                }
                completion(batches)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch batches", error: error, data: nil)
                completion([])
            }
        }
    }

    func deleteBatch(_ batchId: String, completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self = self else {
                completion()
                return
            }

            let fetchRequest: NSFetchRequest<BatchOb> = BatchOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "batchId == %@", batchId)
            fetchRequest.fetchLimit = 1

            do {
                if let batchToDelete = try context.fetch(fetchRequest).first {
                    context.delete(batchToDelete)
                    try context.saveIfNeeded()
                    self.logger.internalLog(level: .debug, message: "Successfully deleted batch with id: \(batchId)", error: nil, data: nil)
                } else {
                    self.logger.internalLog(level: .warning, message: "No batch found with id: \(batchId)", error: nil, data: nil)
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete batch with id: \(batchId)", error: error, data: nil)
            }

            completion()
        }
    }
}
