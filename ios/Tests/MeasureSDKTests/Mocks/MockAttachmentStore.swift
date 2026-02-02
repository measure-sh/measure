//
//  MockAttachmentStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 13/10/25.
//

import Foundation
@testable import Measure

final class MockAttachmentStore: AttachmentStore {
    private struct StoredAttachment {
        var attachment: MsrUploadAttachment
        var sessionId: String
    }

    private var attachments: [String: StoredAttachment] = [:]
    private let lock = NSLock()

    func insert(
        attachment: MsrUploadAttachment,
        sessionId: String
    ) {
        lock.lock()
        defer { lock.unlock() }

        attachments[attachment.id] = StoredAttachment(
            attachment: attachment,
            sessionId: sessionId
        )
    }

    func updateUploadDetails(
        for attachmentId: String,
        uploadUrl: String,
        headers: Data?,
        expiresAt: String?
    ) {
        lock.lock()
        defer { lock.unlock() }

        guard let stored = attachments[attachmentId] else { return }

        let old = stored.attachment

        let updated = MsrUploadAttachment(
            id: old.id,
            name: old.name,
            type: old.type,
            size: old.size,
            bytes: old.bytes,
            path: old.path,
            uploadUrl: uploadUrl,
            expiresAt: expiresAt,
            headers: headers
        )

        attachments[attachmentId] = StoredAttachment(
            attachment: updated,
            sessionId: stored.sessionId
        )
    }

    func getAttachmentsForUpload(batchSize: Number) -> [MsrUploadAttachment] {
        lock.lock()
        defer { lock.unlock() }

        let uploadable = attachments.values
            .map { $0.attachment }
            .filter {
                $0.uploadUrl != nil &&
                $0.headers != nil &&
                $0.bytes != nil
            }
            .prefix(Int(batchSize))

        return Array(uploadable)
    }

    func deleteAttachments(attachmentIds: [String]) {
        lock.lock()
        defer { lock.unlock() }

        attachmentIds.forEach {
            attachments.removeValue(forKey: $0)
        }
    }

    func deleteAttachments(forSessionIds sessionIds: [String]) {
        lock.lock()
        defer { lock.unlock() }

        let sessionSet = Set(sessionIds)

        attachments = attachments.filter {
            !sessionSet.contains($0.value.sessionId)
        }
    }

    func allAttachments() -> [MsrUploadAttachment] {
        lock.lock()
        defer { lock.unlock() }

        return attachments.values.map { $0.attachment }
    }
}
