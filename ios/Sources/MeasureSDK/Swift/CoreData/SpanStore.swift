//
//  SpanStore.swift
//  Measure
//
//  Created by Adwin Ross on 14/04/25.
//

import Foundation
import CoreData

protocol SpanStore {
    func insertSpan(span: SpanEntity)
    func insertSpans(spans: [SpanEntity])
    func getSpans(spanIds: [String]) -> [SpanEntity]?
    func deleteSpans(spanIds: [String])
    func getAllSpans(completion: @escaping ([SpanEntity]?) -> Void)
    func getUnBatchedSpans(spanCount: Int64, ascending: Bool) -> [String]
    func updateBatchId(_ batchId: String, for spans: [String])
    func deleteSpans(sessionIds: [String], completion: @escaping () -> Void)
    func getSpansCount(completion: @escaping (Int) -> Void)
}

final class BaseSpanStore: SpanStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertSpan(span: SpanEntity) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

            let spanOb = SpanOb(context: context)
            spanOb.name = span.name
            spanOb.traceId = span.traceId
            spanOb.spanId = span.spanId
            spanOb.parentId = span.parentId
            spanOb.sessionId = span.sessionId
            spanOb.startTime = span.startTime
            spanOb.startTimeString = span.startTimeString
            spanOb.endTime = span.endTime
            spanOb.endTimeString = span.endTimeString
            spanOb.duration = span.duration
            spanOb.status = span.status ?? 0
            spanOb.attributes = span.attributes
            spanOb.userDefinedAttrs = span.userDefinedAttrs
            spanOb.checkpoints = span.checkpoints
            spanOb.hasEnded = span.hasEnded
            spanOb.isSampled = span.isSampled
            spanOb.batchId = span.batchId

            do {
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(level: .error, message: "Failed to save span: \(span.spanId)", error: error, data: nil)
            }
        }
    }

    func insertSpans(spans: [SpanEntity]) {
        guard !spans.isEmpty else { return }

        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

            for span in spans {
                let spanOb = SpanOb(context: context)
                spanOb.name = span.name
                spanOb.traceId = span.traceId
                spanOb.spanId = span.spanId
                spanOb.parentId = span.parentId
                spanOb.sessionId = span.sessionId
                spanOb.startTime = span.startTime
                spanOb.startTimeString = span.startTimeString
                spanOb.endTime = span.endTime
                spanOb.endTimeString = span.endTimeString
                spanOb.duration = span.duration
                spanOb.status = span.status ?? 0
                spanOb.attributes = span.attributes
                spanOb.userDefinedAttrs = span.userDefinedAttrs
                spanOb.checkpoints = span.checkpoints
                spanOb.hasEnded = span.hasEnded
                spanOb.isSampled = span.isSampled
                spanOb.batchId = span.batchId
            }

            do {
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(
                    level: .error,
                    message: "Failed to save spans batch (count: \(spans.count))",
                    error: error,
                    data: nil
                )
            }
        }
    }

    func getSpans(spanIds: [String]) -> [SpanEntity]? {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return nil
        }

        var result: [SpanEntity]?

        context.performAndWait {
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spanIds)

            do {
                let spans = try context.fetch(fetchRequest)
                result = spans.map { $0.toSpanEntity() }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to fetch spans for IDs",
                    error: error,
                    data: nil
                )
                result = nil
            }
        }

        return result
    }

    func deleteSpans(spanIds: [String]) {
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
            let fetchRequest: NSFetchRequest<NSFetchRequestResult> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spanIds)

            let deleteRequest = NSBatchDeleteRequest(fetchRequest: fetchRequest)
            deleteRequest.resultType = .resultTypeObjectIDs

            do {
                let result = try context.execute(deleteRequest) as? NSBatchDeleteResult
                let objectIDs = result?.result as? [NSManagedObjectID] ?? []

                // Merge deletions so context stays consistent
                NSManagedObjectContext.mergeChanges(
                    fromRemoteContextSave: [NSDeletedObjectsKey: objectIDs],
                    into: [context]
                )

                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to delete spans: \(spanIds)",
                    error: error,
                    data: nil
                )
            }
        }
    }

    func getAllSpans(completion: @escaping ([SpanEntity]?) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(nil)
                return
            }

            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            do {
                let result = try context.fetch(fetchRequest)
                let spans = result.map { $0.toSpanEntity() }
                completion(spans.isEmpty ? nil : spans)
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch spans.", error: error, data: nil)
                completion(nil)
            }
        }
    }

    func getUnBatchedSpans(spanCount: Int64, ascending: Bool) -> [String] {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "Background context not available", error: nil, data: nil)
            return []
        }

        var spanIds: [String] = []

        context.performAndWait {
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "batchId == nil")
            fetchRequest.fetchLimit = Int(spanCount)
            fetchRequest.sortDescriptors = [
                NSSortDescriptor(key: "startTime", ascending: ascending)
            ]

            do {
                let spans = try context.fetch(fetchRequest)
                spanIds = spans.compactMap { $0.spanId }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to fetch unbatched spans",
                    error: error,
                    data: nil
                )
            }
        }

        return spanIds
    }

    func updateBatchId(_ batchId: String, for spans: [String]) {
        guard !spans.isEmpty else { return }

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
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spans)

            do {
                let results = try context.fetch(fetchRequest)
                for span in results {
                    span.batchId = batchId
                }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to update batchId for spans: \(spans)",
                    error: error,
                    data: nil
                )
            }
        }
    }

    func deleteSpans(sessionIds: [String], completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion()
                return
            }

            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

            do {
                let spans = try context.fetch(fetchRequest)
                for span in spans {
                    context.delete(span)
                }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to delete spans by session IDs: \(sessionIds.joined(separator: ","))",
                    error: error,
                    data: nil
                )
            }

            completion()
        }
    }

    func getSpansCount(completion: @escaping (Int) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(0)
                return
            }

            let fetchRequest: NSFetchRequest<NSNumber> = NSFetchRequest(entityName: "SpanOb")
            fetchRequest.resultType = .countResultType

            do {
                let count = try context.count(for: fetchRequest)
                completion(count)
            } catch {
                logger.internalLog(level: .error, message: "Failed to count spans", error: error, data: nil)
                completion(0)
            }
        }
    }
}

extension SpanOb {
    func toSpanEntity() -> SpanEntity {
        return SpanEntity(name: self.name,
                          traceId: self.traceId,
                          spanId: self.spanId,
                          parentId: self.parentId,
                          sessionId: self.sessionId,
                          startTime: self.startTime,
                          startTimeString: self.startTimeString,
                          endTime: self.endTime,
                          endTimeString: self.endTimeString,
                          duration: self.duration,
                          status: self.status,
                          attributes: self.attributes,
                          userDefinedAttrs: self.userDefinedAttrs,
                          checkpoints: self.checkpoints,
                          hasEnded: self.hasEnded,
                          isSampled: self.isSampled,
                          batchId: self.batchId)
    }
}
