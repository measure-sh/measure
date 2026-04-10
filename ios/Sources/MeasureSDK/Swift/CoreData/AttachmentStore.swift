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
    func getAllAttachmentPaths() -> Set<String>
    func deleteExpiredAttachments()
}

final class BaseAttachmentStore: AttachmentStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger
    private let systemFileManager: SystemFileManager

    init(coreDataManager: CoreDataManager, systemFileManager: SystemFileManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.systemFileManager = systemFileManager
        self.logger = logger
    }

    func deleteAttachments(attachmentIds: [String]) {
        guard !attachmentIds.isEmpty else { return }

        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "AttachmentStore: Background context not available",
                error: nil,
                data: nil
            )
            return
        }

        var attachmentsToDeleteFromFS = [String]()
        context.performAndWait {
            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "id IN %@", attachmentIds)

            do {
                let attachments = try context.fetch(fetchRequest)
                attachments.forEach {
                    if let path = $0.path {
                        attachmentsToDeleteFromFS.append(path)
                    }
                    context.delete($0)
                }
                
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "AttachmentStore: Failed to delete attachments by IDs.",
                    error: error,
                    data: ["attachmentIds": attachmentIds]
                )
            }
        }
        attachmentsToDeleteFromFS.forEach { systemFileManager.deleteFile(atPath: $0) }
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
                message: "AttachmentStore: Background context not available",
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
                        message: "AttachmentStore: Attachment with ID \(attachmentId) not found for upload update.",
                        error: nil,
                        data: nil
                    )
                }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "AttachmentStore: Failed to update upload details for attachment.",
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
                message: "AttachmentStore: Background context not available",
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
                    message: "AttachmentStore: Failed to fetch attachments for upload.",
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
                message: "AttachmentStore: Background context not available",
                error: nil,
                data: nil
            )
            return
        }

        var attachmentsToDeleteFromFS = [String]()
        context.performAndWait {
            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

            do {
                let attachments = try context.fetch(fetchRequest)

                logger.internalLog(
                    level: .debug,
                    message: "AttachmentStore: Deleting \(attachments.count) attachments for \(sessionIds.count) sessions.",
                    error: nil,
                    data: ["sessionIds": sessionIds]
                )

                attachments.forEach {
                    if let path = $0.path {
                        attachmentsToDeleteFromFS.append(path)
                    }
                    context.delete($0)
                }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "AttachmentStore: Failed to delete attachments for session IDs.",
                    error: error,
                    data: ["sessionIds": sessionIds]
                )
            }
        }
        attachmentsToDeleteFromFS.forEach { systemFileManager.deleteFile(atPath: $0) }
    }

    func getAllAttachmentPaths() -> Set<String> {
        guard let context = coreDataManager.backgroundContext else {
            return []
        }

        var paths = Set<String>()

        context.performAndWait {
            let fetchRequest = NSFetchRequest<NSDictionary>(entityName: "AttachmentOb")
            fetchRequest.resultType = .dictionaryResultType
            fetchRequest.propertiesToFetch = ["path"]

            do {
                let results = try context.fetch(fetchRequest)

                for result in results {
                    if let path = result["path"] as? String {
                        paths.insert(path)
                    }
                }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "AttachmentStore: Failed to fetch attachment paths for orphan cleanup.",
                    error: error,
                    data: nil
                )
            }
        }

        return paths
    }

    func deleteExpiredAttachments() {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "AttachmentStore: Background context not available", error: nil, data: nil)
            return
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = Date()

        var attachmentsToDeleteFromFS = [String]()

        context.performAndWait {
            let fetchRequest: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "expires_at != nil")

            do {
                let attachments = try context.fetch(fetchRequest)
                let expired = attachments.filter {
                    guard let expiresAtString = $0.expires_at,
                          let expiresAt = formatter.date(from: expiresAtString) else { return false }
                    return expiresAt < now
                }

                guard !expired.isEmpty else { return }

                logger.internalLog(
                    level: .debug,
                    message: "AttachmentStore: Cleanup Service: Deleting \(expired.count) expired attachments",
                    error: nil,
                    data: nil
                )

                expired.forEach {
                    if let path = $0.path {
                        attachmentsToDeleteFromFS.append(path)
                    }
                    context.delete($0)
                }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "AttachmentStore: Failed to delete expired attachments.",
                    error: error,
                    data: nil
                )
            }
        }

        attachmentsToDeleteFromFS.forEach { systemFileManager.deleteFile(atPath: $0) }
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
