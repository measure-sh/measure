//
//  MockAttachmentStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 13/10/25.
//

import Foundation
@testable import Measure

final class MockAttachmentStore: AttachmentStore {
    private var attachments: [String: [MsrUploadAttachment]] = [:]

    var attachmentsToReturn: [MsrUploadAttachment] {
        return attachments.values
            .flatMap { $0 }
            .filter { $0.uploadUrl != nil }
    }

    func insertAttachment(_ attachment: MsrUploadAttachment, sessionId: String) {
        if var sessionAttachments = attachments[sessionId] {
            if let index = sessionAttachments.firstIndex(where: { $0.id == attachment.id }) {
                sessionAttachments[index] = attachment
            } else {
                sessionAttachments.append(attachment)
            }
            attachments[sessionId] = sessionAttachments
        } else {
            attachments[sessionId] = [attachment]
        }
    }

    func deleteAttachments(attachmentIds: [String], completion: @escaping () -> Void) {
        attachments = attachments.mapValues { sessionAttachments in
            sessionAttachments.filter { !attachmentIds.contains($0.id) }
        }

        attachments = attachments.filter { !$0.value.isEmpty }

        completion()
    }

    func updateUploadDetails(for attachmentId: String, uploadUrl: String, headers: Data?, expiresAt: String?, completion: @escaping () -> Void) {
        for (sessionId, sessionAttachments) in attachments {
            if let index = sessionAttachments.firstIndex(where: { $0.id == attachmentId }) {
                let originalAttachment = sessionAttachments[index]
                let updatedAttachment = MsrUploadAttachment(id: originalAttachment.id,
                                                            name: originalAttachment.name,
                                                            type: originalAttachment.type,
                                                            size: originalAttachment.size,
                                                            bytes: originalAttachment.bytes,
                                                            path: originalAttachment.path,
                                                            uploadUrl: uploadUrl,
                                                            expiresAt: expiresAt,
                                                            headers: headers)
                var newAttachments = sessionAttachments
                newAttachments[index] = updatedAttachment
                attachments[sessionId] = newAttachments

                completion()
                return
            }
        }
        completion()
    }

    func getAttachmentsForUpload(for eventId: String, completion: @escaping ([MsrUploadAttachment]) -> Void) {
        completion(attachmentsToReturn)
    }

    func getAttachmentsForUpload(batchSize: Int, completion: @escaping ([MsrUploadAttachment]) -> Void) {
        let result = attachmentsToReturn.prefix(batchSize).map { $0 }
        completion(Array(result))
    }

    func deleteAttachments(forSessionIds sessionIds: [String], completion: @escaping () -> Void) {
        for sessionId in sessionIds {
            attachments.removeValue(forKey: sessionId)
        }
        completion()
    }

    func reset() {
        attachments = [:]
    }
}
