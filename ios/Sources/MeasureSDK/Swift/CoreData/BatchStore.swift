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
    func getBatch(_ batchId: String) -> BatchEntity?
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
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return false
        }

        var inserted = false

        context.performAndWait {
            let batchOb = BatchOb(context: context)
            batchOb.batchId = batch.batchId
            batchOb.createdAt = batch.createdAt
            batchOb.eventId = batch.eventIds.joined(separator: ",")
            batchOb.spanIds = batch.spanIds.joined(separator: ",")

            do {
                try context.saveIfNeeded()
                inserted = true
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to save batch: \(batch.batchId)",
                    error: error,
                    data: nil
                )
                inserted = false
            }
        }

        return inserted
    }

    func getBatches(_ maxNumberOfBatches: Int) -> [BatchEntity] {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return []
        }

        var batches: [BatchEntity] = []

        context.performAndWait {
            let fetchRequest: NSFetchRequest<BatchOb> = BatchOb.fetchRequest()
            fetchRequest.fetchLimit = maxNumberOfBatches

            do {
                let results = try context.fetch(fetchRequest)
                batches = results.compactMap { batchOb in
                    guard let batchId = batchOb.batchId else { return nil }

                    let eventIds = batchOb.eventId?.components(separatedBy: ",") ?? []
                    let spanIds = batchOb.spanIds?.components(separatedBy: ",") ?? []

                    return BatchEntity(
                        batchId: batchId,
                        eventIds: eventIds,
                        spanIds: spanIds,
                        createdAt: batchOb.createdAt
                    )
                }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to fetch batches",
                    error: error,
                    data: nil
                )
                batches = []
            }
        }

        return batches
    }

    func getBatch(_ batchId: String) -> BatchEntity? {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return nil
        }

        var batchEntity: BatchEntity?

        context.performAndWait {
            let fetchRequest: NSFetchRequest<BatchOb> = BatchOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.predicate = NSPredicate(format: "batchId == %@", batchId)

            do {
                guard let batchOb = try context.fetch(fetchRequest).first,
                      let batchId = batchOb.batchId else {
                    batchEntity = nil
                    return
                }

                let eventIds = batchOb.eventId?.components(separatedBy: ",") ?? []
                let spanIds = batchOb.spanIds?.components(separatedBy: ",") ?? []

                batchEntity = BatchEntity(
                    batchId: batchId,
                    eventIds: eventIds,
                    spanIds: spanIds,
                    createdAt: batchOb.createdAt
                )
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to fetch batch \(batchId)",
                    error: error,
                    data: nil
                )
                batchEntity = nil
            }
        }

        return batchEntity
    }

    func deleteBatch(_ batchId: String) {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return
        }

        context.performAndWait {
            let fetchRequest: NSFetchRequest<NSFetchRequestResult> = BatchOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "batchId == %@", batchId)
            fetchRequest.fetchLimit = 1

            let deleteRequest = NSBatchDeleteRequest(fetchRequest: fetchRequest)
            deleteRequest.resultType = .resultTypeObjectIDs

            do {
                let result = try context.execute(deleteRequest) as? NSBatchDeleteResult
                let objectIDs = result?.result as? [NSManagedObjectID] ?? []

                if objectIDs.isEmpty {
                    logger.internalLog(
                        level: .warning,
                        message: "No batch found with id: \(batchId)",
                        error: nil,
                        data: nil
                    )
                    return
                }

                // Keep context consistent
                NSManagedObjectContext.mergeChanges(
                    fromRemoteContextSave: [NSDeletedObjectsKey: objectIDs],
                    into: [context]
                )

                try context.saveIfNeeded()

                logger.internalLog(
                    level: .debug,
                    message: "Successfully deleted batch with id: \(batchId)",
                    error: nil,
                    data: nil
                )
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to delete batch with id: \(batchId)",
                    error: error,
                    data: nil
                )
            }
        }
    }
}
