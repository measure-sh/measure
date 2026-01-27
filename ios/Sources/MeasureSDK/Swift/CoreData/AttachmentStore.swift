//
//  AttachmentStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 09/10/25.
//

import Foundation
import CoreData

protocol AttachmentStore {
    func deleteAttachments(attachmentIds: [String])
    func updateUploadDetails(for attachmentId: String, uploadUrl: String, headers: Data?, expiresAt: String?)
    func getAttachmentsForUpload(batchSize: Number) -> [MsrUploadAttachment]
    func deleteAttachments(forSessionIds sessionIds: [String])
}

final class BaseAttachmentStore: AttachmentStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func deleteAttachments(attachmentIds: [String]) {
        guard !attachmentIds.isEmpty else { return }

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
            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "id IN %@", attachmentIds)

            do {
                let attachments = try context.fetch(fetchRequest)
                attachments.forEach { context.delete($0) }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to delete attachments by IDs.",
                    error: error,
                    data: ["attachmentIds": attachmentIds]
                )
            }
        }
    }

    func updateUploadDetails(
        for attachmentId: String,
        uploadUrl: String,
        headers: Data?,
        expiresAt: String?
    ) {
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
            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.predicate = NSPredicate(format: "id == %@", attachmentId)

            do {
                if let attachment = try context.fetch(fetchRequest).first {
                    attachment.uploadUrl = uploadUrl
                    attachment.headers = headers
                    attachment.expires_at = expiresAt
                    try context.saveIfNeeded()
                } else {
                    logger.internalLog(
                        level: .warning,
                        message: "Attachment with ID \(attachmentId) not found for upload update.",
                        error: nil,
                        data: nil
                    )
                }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to update upload details for attachment.",
                    error: error,
                    data: ["attachmentId": attachmentId]
                )
            }
        }
    }

    func getAttachmentsForUpload(batchSize: Number) -> [MsrUploadAttachment] {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return []
        }

        var result: [MsrUploadAttachment] = []

        context.performAndWait {
            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "uploadUrl != nil AND uploadUrl != ''")
            fetchRequest.fetchLimit = Int(batchSize)

            do {
                let attachments = try context.fetch(fetchRequest)
                result = attachments.compactMap { $0.toUploadEntity() }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to fetch attachments for upload.",
                    error: error,
                    data: ["batchSize": batchSize]
                )
            }
        }

        return result
    }

    func deleteAttachments(forSessionIds sessionIds: [String]) {
        guard !sessionIds.isEmpty else { return }

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
            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

            do {
                let attachments = try context.fetch(fetchRequest)

                logger.internalLog(
                    level: .debug,
                    message: "Deleting \(attachments.count) attachments for \(sessionIds.count) sessions.",
                    error: nil,
                    data: ["sessionIds": sessionIds]
                )

                attachments.forEach { context.delete($0) }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to delete attachments for session IDs.",
                    error: error,
                    data: ["sessionIds": sessionIds]
                )
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
                                   uploadUrl: uploadUrl,
                                   expiresAt: expires_at,
                                   headers: headers)
    }
}
