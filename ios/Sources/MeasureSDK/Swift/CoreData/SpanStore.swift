//
//  SpanStore.swift
//  Measure
//
//  Created by Adwin Ross on 14/04/25.
//

import Foundation
import CoreData

protocol SpanStore {
    func insertSpan(span: SpanEntity) async
    func getSpans(spanIds: [String]) async -> [SpanEntity]?
    func deleteSpans(spanIds: [String]) async
    func getAllSpans() async -> [SpanEntity]?
    func getUnBatchedSpans(spanCount: Int64, ascending: Bool) async -> [String]
    func updateBatchId(_ batchId: String, for spans: [String]) async
    func deleteSpans(sessionIds: [String]) async
}

final class BaseSpanStore: SpanStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertSpan(span: SpanEntity) async {
        await coreDataManager.performBackgroundTask { context in
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
                self.logger.internalLog(level: .error, message: "Failed to save span: \(span.spanId)", error: error, data: nil)
            }
        }
    }

    func getSpans(spanIds: [String]) async -> [SpanEntity]? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spanIds)

            do {
                let spans = try context.fetch(fetchRequest)
                return spans.map { $0.toSpanEntity() }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch spans for IDs", error: error, data: nil)
                return nil
            }
        }
    }

    func deleteSpans(spanIds: [String]) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<NSFetchRequestResult> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spanIds)

            let deleteRequest = NSBatchDeleteRequest(fetchRequest: fetchRequest)

            do {
                try context.execute(deleteRequest)
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete spans", error: error, data: nil)
            }
        }
    }

    func getAllSpans() async -> [SpanEntity]? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()

            do {
                let results = try context.fetch(fetchRequest)
                let spans = results.map { spanOb in
                    SpanEntity(
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
                    )
                }
                return spans.isEmpty ? nil : spans
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch spans.", error: error, data: nil)
                return nil
            }
        }
    }

    func getUnBatchedSpans(spanCount: Int64, ascending: Bool) async -> [String] {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "batchId == nil")
            fetchRequest.fetchLimit = Int(spanCount)
            fetchRequest.sortDescriptors = [NSSortDescriptor(key: "startTime", ascending: ascending)]

            do {
                let spans = try context.fetch(fetchRequest)
                return spans.compactMap { $0.spanId }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch unbatched spans", error: error, data: nil)
                return []
            }
        } ?? []
    }

    func updateBatchId(_ batchId: String, for spans: [String]) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "spanId IN %@", spans)

            do {
                let results = try context.fetch(fetchRequest)
                for span in results {
                    span.batchId = batchId
                }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to update batchId for spans: \(spans)", error: error, data: nil)
            }
        }
    }

    func deleteSpans(sessionIds: [String]) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SpanOb> = SpanOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

            do {
                let spans = try context.fetch(fetchRequest)
                for span in spans {
                    context.delete(span)
                }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete spans by session IDs: \(sessionIds.joined(separator: ","))", error: error, data: nil)
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
