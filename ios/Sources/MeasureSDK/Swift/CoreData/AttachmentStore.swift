//
//  AttachmentStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 09/10/25.
//

import Foundation
import CoreData

protocol AttachmentStore {
    func deleteAttachments(attachmentIds: [String], completion: @escaping () -> Void)
    func updateUploadUrl(for attachmentId: String, uploadUrl: String, completion: @escaping () -> Void)
    func getAttachmentsForUpload(for eventId: String, completion: @escaping ([MsrUploadAttachment]) -> Void)
    func getAttachmentsForUpload(completion: @escaping ([MsrUploadAttachment]) -> Void)
    func getOrphanedAttachments(completion: @escaping ([String]) -> Void)
}

final class BaseAttachmentStore: AttachmentStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func deleteAttachments(attachmentIds: [String], completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { completion(); return }

            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "id IN %@", attachmentIds)

            do {
                let attachments = try context.fetch(fetchRequest)
                attachments.forEach { context.delete($0) }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete attachments by IDs.", error: error, data: nil)
            }
            completion()
        }
    }

    func updateUploadUrl(for attachmentId: String, uploadUrl: String, completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { completion(); return }

            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.predicate = NSPredicate(format: "id == %@", attachmentId)

            do {
                if let attachmentOb = try context.fetch(fetchRequest).first {
                    attachmentOb.uploadUrl = uploadUrl
                    try context.saveIfNeeded()
                } else {
                    self.logger.internalLog(level: .warning, message: "Attachment with ID \(attachmentId) not found for URL update.", error: nil, data: nil)
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to update uploadUrl for attachment \(attachmentId).", error: error, data: nil)
            }
            completion()
        }
    }

    func getOrphanedAttachments(completion: @escaping ([String]) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { completion([]); return }

            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "eventRel == nil")
            
            fetchRequest.resultType = .dictionaryResultType
            fetchRequest.propertiesToFetch = ["id"]

            var orphanedIds: [String] = []
            do {
                let results = try context.fetch(fetchRequest) as? [[String: String]] ?? []
                orphanedIds = results.compactMap { $0["id"] }
                completion(orphanedIds)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch orphaned attachment IDs.", error: error, data: nil)
                completion([])
            }
        }
    }

    func getAttachmentsForUpload(for eventId: String, completion: @escaping ([MsrUploadAttachment]) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { completion([]); return }

            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            // Fetch attachments linked to the event AND which have a signed URL
            let eventPredicate = NSPredicate(format: "eventRel.id == %@", eventId)
            let urlPredicate = NSPredicate(format: "uploadUrl != nil")
            fetchRequest.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [eventPredicate, urlPredicate])

            do {
                let attachments = try context.fetch(fetchRequest)
                // Use the new toUploadEntity() conversion
                let uploadAttachments = attachments.compactMap { $0.toUploadEntity() }
                completion(uploadAttachments)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch attachments for upload for event ID \(eventId).", error: error, data: nil)
                completion([])
            }
        }
    }

    func getAttachmentsForUpload(completion: @escaping ([MsrUploadAttachment]) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { completion([]); return }

            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "uploadUrl != nil")
            
            do {
                let attachments = try context.fetch(fetchRequest)

                let uploadAttachments = attachments.compactMap { $0.toUploadEntity() }
                
                completion(uploadAttachments)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch all attachments with upload URLs.", error: error, data: nil)
                completion([])
            }
        }
    }
}

extension AttachmentOb {
    func toUploadEntity() -> MsrUploadAttachment? {
        guard let id = id,
              let name = name,
              let typeRawValue = type,
              let attachmentType = AttachmentType(rawValue: typeRawValue),
              let uploadUrl = uploadUrl else {
            return nil
        }

        return MsrUploadAttachment(id: id,
                                   name: name,
                                   type: attachmentType,
                                   size: attachmentSize,
                                   bytes: bytes,
                                   path: path,
                                   uploadUrl: uploadUrl)
    }
}
