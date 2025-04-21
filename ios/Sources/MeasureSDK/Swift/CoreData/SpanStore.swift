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
    func getSpans(spanIds: [String]) -> [SpanEntity]?
    func deleteSpans(spanIds: [String])
    func getAllSpans() -> [SpanEntity]?
    func getUnBatchedSpans(spanCount: Int64, ascending: Bool) -> [String]
    func updateBatchId(_ batchId: String, for spans: [String])
    func deleteSpans(sessionIds: [String])
}

final class BaseSpanStore: SpanStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertSpan(span: SpanEntity) {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return
        }

        context.performAndWait { [weak self] in
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
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to save span: \(span.spanId)", error: error, data: nil)
            }
        }
    }

    func getSpans(spanIds: [String]) -> [SpanEntity]? {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return nil
        }

        var results: [SpanEntity]?
        context.performAndWait {
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spanIds)

            do {
                let spans = try context.fetch(fetchRequest)
                results = spans.map { $0.toSpanEntity() }
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch spans for IDs", error: error, data: nil)
            }
        }
        return results
    }

    func deleteSpans(spanIds: [String]) {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return
        }

        context.performAndWait { [weak self] in
            let fetchRequest: NSFetchRequest<NSFetchRequestResult> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spanIds)

            let deleteRequest = NSBatchDeleteRequest(fetchRequest: fetchRequest)

            do {
                try context.execute(deleteRequest)
                try context.saveIfNeeded()
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to delete spans", error: error, data: nil)
            }
        }
    }

    func getAllSpans() -> [SpanEntity]? {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return nil
        }

        let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
        var spans: [SpanEntity] = []

        context.performAndWait { [weak self] in
            do {
                let result = try context.fetch(fetchRequest)
                for spanOb in result {
                    spans.append(SpanEntity(
                        name: spanOb.name,
                        traceId: spanOb.traceId,
                        spanId: spanOb.spanId,
                        parentId: spanOb.parentId,
                        sessionId: spanOb.sessionId,
                        startTime: spanOb.startTime,
                        startTimeString: spanOb.startTimeString,
                        endTime: spanOb.endTime,
                        endTimeString: spanOb.endTimeString,
                        duration: spanOb.duration,
                        status: spanOb.status,
                        attributes: spanOb.attributes,
                        userDefinedAttrs: spanOb.userDefinedAttrs,
                        checkpoints: spanOb.checkpoints,
                        hasEnded: spanOb.hasEnded,
                        isSampled: spanOb.isSampled,
                        batchId: spanOb.batchId
                    ))
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to fetch spans.", error: error, data: nil)
            }
        }

        return spans.isEmpty ? nil : spans
    }

    func getUnBatchedSpans(spanCount: Int64, ascending: Bool) -> [String] {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return []
        }

        var results: [String] = []
        context.performAndWait {
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "batchId == nil")
            fetchRequest.fetchLimit = Int(spanCount)
            fetchRequest.sortDescriptors = [NSSortDescriptor(key: "startTime", ascending: ascending)]

            do {
                let spans = try context.fetch(fetchRequest)
                results = spans.compactMap { $0.spanId }
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch unbatched spans", error: error, data: nil)
            }
        }
        return results
    }

    func updateBatchId(_ batchId: String, for spans: [String]) {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return
        }

        context.performAndWait { [weak self] in
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spans)

            do {
                let results = try context.fetch(fetchRequest)
                for span in results {
                    span.batchId = batchId
                }
                try context.saveIfNeeded()
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to update batchId for spans: \(spans)", error: error, data: nil)
            }
        }
    }

    func deleteSpans(sessionIds: [String]) {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "coreDataManager.backgroundContext is nil", error: nil, data: nil)
            return
        }

        let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

        context.performAndWait { [weak self] in
            do {
                let spans = try context.fetch(fetchRequest)
                for span in spans {
                    context.delete(span)
                }
                try context.saveIfNeeded()
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(
                    level: .error,
                    message: "Failed to delete spans by session IDs: \(sessionIds.joined(separator: ","))",
                    error: error,
                    data: nil
                )
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
