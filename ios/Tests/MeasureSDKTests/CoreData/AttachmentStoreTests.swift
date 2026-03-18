//
//  AttachmentStoreTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 05/03/26.
//

import XCTest
@testable import Measure
import CoreData

final class AttachmentStoreTests: XCTestCase {
    var coreDataManager: MockCoreDataManager!
    var logger: MockLogger!
    var attachmentStore: AttachmentStore!
    var systemFileManager: MockSystemFileManager!

    override func setUp() {
        super.setUp()
        coreDataManager = MockCoreDataManager()
        logger = MockLogger()
        systemFileManager = MockSystemFileManager()
        attachmentStore = BaseAttachmentStore(
            coreDataManager: coreDataManager,
            systemFileManager: systemFileManager,
            logger: logger
        )
    }

    override func tearDown() {
        super.tearDown()
        systemFileManager = nil
        attachmentStore = nil
        coreDataManager = nil
        logger = nil
    }

    @discardableResult
    private func insertAttachment(
        id: String = UUID().uuidString,
        name: String = "test.png",
        type: String = "screenshot",
        sessionId: String = "session-1",
        uploadUrl: String? = nil,
        expiresAt: String? = nil,
        headers: Data? = nil,
        path: String? = nil,
        bytes: Data? = Data("test".utf8)
    ) -> String {
        let context = coreDataManager.backgroundContext!
        context.performAndWait {
            let attachment = AttachmentOb(context: context)
            attachment.id = id
            attachment.name = name
            attachment.type = type
            attachment.sessionId = sessionId
            attachment.uploadUrl = uploadUrl
            attachment.expires_at = expiresAt
            attachment.headers = headers
            attachment.path = path
            attachment.bytes = bytes
            let _ = try? context.saveIfNeeded()
        }
        return id
    }

    private func makeHeaders() -> Data {
        try! JSONSerialization.data(withJSONObject: ["Authorization": "Bearer token"])
    }

    private func expiresAt(offsetSeconds: TimeInterval) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date().addingTimeInterval(offsetSeconds))
    }

    func test_deleteAttachments_byIds_deletesASingleAttachment() {
        let id = insertAttachment()

        attachmentStore.deleteAttachments(attachmentIds: [id])

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 0)
    }

    func test_deleteAttachments_byIds_deletesMultipleAttachments() {
        let id1 = insertAttachment(id: "a1")
        let id2 = insertAttachment(id: "a2")
        let id3 = insertAttachment(id: "a3")

        attachmentStore.deleteAttachments(attachmentIds: [id1, id2, id3])

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 0)
    }

    func test_deleteAttachments_byIds_deletesAssociatedFileFromFileSystem() {
        let path = "attachments/test.png"
        systemFileManager.savedFiles[path] = Data("test".utf8)
        let id = insertAttachment(path: path)

        attachmentStore.deleteAttachments(attachmentIds: [id])

        XCTAssertNil(systemFileManager.savedFiles[path])
    }

    func test_deleteAttachments_byIds_doesNothingForEmptyArray() {
        insertAttachment(id: "a1")
        insertAttachment(id: "a2")

        attachmentStore.deleteAttachments(attachmentIds: [])

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 2)
    }

    func test_deleteAttachments_byIds_ignoresNonExistentIds() {
        let id = insertAttachment(id: "a1")

        attachmentStore.deleteAttachments(attachmentIds: ["non-existent"])

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 1)
        _ = id
    }

    func test_updateUploadDetails_updatesAllFields() {
        let id = insertAttachment()
        let headers = makeHeaders()
        let expiry = expiresAt(offsetSeconds: 3600)

        attachmentStore.updateUploadDetails(
            for: id,
            uploadUrl: "https://example.com/upload",
            headers: headers,
            expiresAt: expiry
        )

        let context = coreDataManager.backgroundContext!
        var updated: AttachmentOb?
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            req.predicate = NSPredicate(format: "id == %@", id)    
            updated = try? context.fetch(req).first
        }
        XCTAssertEqual(updated?.uploadUrl, "https://example.com/upload")
        XCTAssertEqual(updated?.headers, headers)
        XCTAssertEqual(updated?.expires_at, expiry)
    }

    func test_updateUploadDetails_doesNothingForNonExistentId() {
        insertAttachment(id: "a1", uploadUrl: "https://example.com/old")

        attachmentStore.updateUploadDetails(
            for: "non-existent",
            uploadUrl: "https://example.com/new",
            headers: nil,
            expiresAt: nil
        )

        let context = coreDataManager.backgroundContext!
        var attachment: AttachmentOb?
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            req.predicate = NSPredicate(format: "id == %@", "a1")
            attachment = try? context.fetch(req).first
        }
        XCTAssertEqual(attachment?.uploadUrl, "https://example.com/old")
    }

    func test_updateUploadDetails_canSetExpiresAtToNil() {
        let id = insertAttachment(expiresAt: expiresAt(offsetSeconds: 3600))

        attachmentStore.updateUploadDetails(
            for: id,
            uploadUrl: "https://example.com/upload",
            headers: nil,
            expiresAt: nil
        )

        let context = coreDataManager.backgroundContext!
        var attachment: AttachmentOb?
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            req.predicate = NSPredicate(format: "id == %@", id)
            attachment = try? context.fetch(req).first
        }
        XCTAssertNil(attachment?.expires_at)
    }

    func test_updateUploadDetails_canSetHeadersToNil() {
        let id = insertAttachment(headers: makeHeaders())

        attachmentStore.updateUploadDetails(
            for: id,
            uploadUrl: "https://example.com/upload",
            headers: nil,
            expiresAt: nil
        )

        let context = coreDataManager.backgroundContext!
        var attachment: AttachmentOb?
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            req.predicate = NSPredicate(format: "id == %@", id)
            attachment = try? context.fetch(req).first
        }
        XCTAssertNil(attachment?.headers)
    }

    func test_getAttachmentsForUpload_returnsOnlyAttachmentsWithUploadUrl() {
        insertAttachment(id: "a1", uploadUrl: "https://example.com/upload")
        insertAttachment(id: "a2", uploadUrl: nil)

        let results = attachmentStore.getAttachmentsForUpload(batchSize: 10)

        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.id, "a1")
    }

    func test_getAttachmentsForUpload_respectsBatchSizeLimit() {
        insertAttachment(id: "a1", uploadUrl: "https://example.com/1")
        insertAttachment(id: "a2", uploadUrl: "https://example.com/2")
        insertAttachment(id: "a3", uploadUrl: "https://example.com/3")

        let results = attachmentStore.getAttachmentsForUpload(batchSize: 2)

        XCTAssertEqual(results.count, 2)
    }

    func test_getAttachmentsForUpload_returnsEmptyWhenNoUploadUrls() {
        insertAttachment(id: "a1", uploadUrl: nil)
        insertAttachment(id: "a2", uploadUrl: nil)

        let results = attachmentStore.getAttachmentsForUpload(batchSize: 10)

        XCTAssertTrue(results.isEmpty)
    }

    func test_getAttachmentsForUpload_excludesAttachmentsWithEmptyUploadUrl() {
        insertAttachment(id: "a1", uploadUrl: "")

        let results = attachmentStore.getAttachmentsForUpload(batchSize: 10)

        XCTAssertTrue(results.isEmpty)
    }

    func test_deleteAttachments_forSessionIds_deletesAllAttachmentsInSession() {
        insertAttachment(id: "a1", sessionId: "session-1")
        insertAttachment(id: "a2", sessionId: "session-1")

        attachmentStore.deleteAttachments(forSessionIds: ["session-1"])

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 0)
    }

    func test_deleteAttachments_forSessionIds_deletesAcrossMultipleSessions() {
        insertAttachment(id: "a1", sessionId: "session-1")
        insertAttachment(id: "a2", sessionId: "session-2")
        insertAttachment(id: "a3", sessionId: "session-3")

        attachmentStore.deleteAttachments(forSessionIds: ["session-1", "session-2"])

        let context = coreDataManager.backgroundContext!
        var remaining: [AttachmentOb] = []
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            remaining = (try? context.fetch(req)) ?? []
        }
        XCTAssertEqual(remaining.count, 1)
        XCTAssertEqual(remaining.first?.id, "a3")
    }

    func test_deleteAttachments_forSessionIds_deletesAssociatedFilesFromFileSystem() {
        let path = "attachments/test.png"
        systemFileManager.savedFiles[path] = Data("test".utf8)
        insertAttachment(id: "a1", sessionId: "session-1", path: path)

        attachmentStore.deleteAttachments(forSessionIds: ["session-1"])

        XCTAssertNil(systemFileManager.savedFiles[path])
    }

    func test_deleteAttachments_forSessionIds_doesNotDeleteOtherSessions() {
        insertAttachment(id: "a1", sessionId: "session-1")
        insertAttachment(id: "a2", sessionId: "session-2")

        attachmentStore.deleteAttachments(forSessionIds: ["session-1"])

        let context = coreDataManager.backgroundContext!
        var remaining: [AttachmentOb] = []
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            remaining = (try? context.fetch(req)) ?? []
        }
        XCTAssertEqual(remaining.count, 1)
        XCTAssertEqual(remaining.first?.id, "a2")
    }

    func test_deleteAttachments_forSessionIds_doesNothingForEmptyArray() {
        insertAttachment(id: "a1", sessionId: "session-1")

        attachmentStore.deleteAttachments(forSessionIds: [])

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 1)
    }

    func test_getAllAttachmentPaths_returnsPathsOfAllAttachments() {
        insertAttachment(id: "a1", path: "attachments/a.png")
        insertAttachment(id: "a2", path: "attachments/b.png")

        let paths = attachmentStore.getAllAttachmentPaths()

        XCTAssertEqual(paths, Set(["attachments/a.png", "attachments/b.png"]))
    }

    func test_getAllAttachmentPaths_excludesAttachmentsWithNilPath() {
        insertAttachment(id: "a1", path: "attachments/a.png")
        insertAttachment(id: "a2", path: nil)

        let paths = attachmentStore.getAllAttachmentPaths()

        XCTAssertEqual(paths, Set(["attachments/a.png"]))
    }

    func test_getAllAttachmentPaths_returnsEmptySetWhenNoAttachments() {
        let paths = attachmentStore.getAllAttachmentPaths()

        XCTAssertTrue(paths.isEmpty)
    }

    func test_deleteExpiredAttachments_deletesExpiredAttachments() {
        insertAttachment(id: "a1", expiresAt: expiresAt(offsetSeconds: -3600))

        attachmentStore.deleteExpiredAttachments()

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 0)
    }

    func test_deleteExpiredAttachments_doesNotDeleteFutureAttachments() {
        insertAttachment(id: "a1", expiresAt: expiresAt(offsetSeconds: 3600))

        attachmentStore.deleteExpiredAttachments()

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 1)
    }

    func test_deleteExpiredAttachments_doesNotDeleteAttachmentsWithNilExpiresAt() {
        insertAttachment(id: "a1", expiresAt: nil)

        attachmentStore.deleteExpiredAttachments()

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 1)
    }

    func test_deleteExpiredAttachments_deletesAssociatedFilesFromFileSystem() {
        let path = "attachments/expired.png"
        systemFileManager.savedFiles[path] = Data("test".utf8)
        insertAttachment(id: "a1", expiresAt: expiresAt(offsetSeconds: -3600), path: path)

        attachmentStore.deleteExpiredAttachments()

        XCTAssertNil(systemFileManager.savedFiles[path])
    }

    func test_deleteExpiredAttachments_doesNothingWhenNoExpiredAttachments() {
        insertAttachment(id: "a1", expiresAt: expiresAt(offsetSeconds: 3600))
        insertAttachment(id: "a2", expiresAt: nil)

        attachmentStore.deleteExpiredAttachments()

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 2)
    }

    func test_deleteExpiredAttachments_ignoresMalformedExpiresAtString() {
        insertAttachment(id: "a1", expiresAt: "not-a-valid-date")

        attachmentStore.deleteExpiredAttachments()

        let context = coreDataManager.backgroundContext!
        var count = 0
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            count = (try? context.fetch(req))?.count ?? 0
        }
        XCTAssertEqual(count, 1)
    }

    func test_deleteExpiredAttachments_onlyDeletesExpiredAmongMixed() {
        insertAttachment(id: "expired", expiresAt: expiresAt(offsetSeconds: -3600))
        insertAttachment(id: "valid", expiresAt: expiresAt(offsetSeconds: 3600))
        insertAttachment(id: "no-expiry", expiresAt: nil)

        attachmentStore.deleteExpiredAttachments()

        let context = coreDataManager.backgroundContext!
        var remaining: [AttachmentOb] = []
        context.performAndWait {
            let req: NSFetchRequest<AttachmentOb> = AttachmentOb.fetchRequest()
            remaining = (try? context.fetch(req)) ?? []
        }
        let remainingIds = Set(remaining.compactMap { $0.id })
        XCTAssertEqual(remainingIds, Set(["valid", "no-expiry"]))
    }
}
