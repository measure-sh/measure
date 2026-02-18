//
//  ExporterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/01/26.
//

import XCTest
@testable import Measure

final class BaseExporterTests: XCTestCase {
    private var exporter: BaseExporter!
    private var network: MockNetworkClient!
    private var http: MockHttpClient!
    private var eventStore: MockEventStore!
    private var spanStore: MockSpanStore!
    private var batchStore: MockBatchStore!
    private var attachmentStore: MockAttachmentStore!
    private var sessionStore: MockSessionStore!
    private var config: MockConfigProvider!
    private var systemFileManager: MockSystemFileManager!

    override func setUp() {
        super.setUp()

        network = MockNetworkClient()
        http = MockHttpClient()
        eventStore = MockEventStore()
        spanStore = MockSpanStore()
        batchStore = MockBatchStore()
        attachmentStore = MockAttachmentStore()
        sessionStore = MockSessionStore()
        config = MockConfigProvider()
        systemFileManager = MockSystemFileManager()

        exporter = BaseExporter(
            logger: MockLogger(),
            idProvider: MockIdProvider(),
            dispatchQueue: DispatchQueue.main,
            timeProvider: MockTimeProvider(),
            networkClient: network,
            httpClient: http,
            eventStore: eventStore,
            spanStore: spanStore,
            batchStore: batchStore,
            attachmentStore: attachmentStore,
            sessionStore: sessionStore,
            configProvider: config,
            systemFileManager: systemFileManager
        )
    }

    override func tearDown() {
        exporter = nil
        network = nil
        http = nil
        eventStore = nil
        spanStore = nil
        batchStore = nil
        attachmentStore = nil
        sessionStore = nil
        config = nil
        systemFileManager = nil
    }

    private func makeEvent(id: String, sessionId: String) -> EventEntity {
        EventEntity(
            id: id,
            sessionId: sessionId,
            timestamp: "t",
            type: "custom",
            exception: nil,
            attachments: nil,
            attributes: nil,
            userDefinedAttributes: nil,
            gestureClick: nil,
            gestureLongClick: nil,
            gestureScroll: nil,
            userTriggered: false,
            timestampInMillis: 1,
            batchId: nil,
            lifecycleApp: nil,
            lifecycleViewController: nil,
            lifecycleSwiftUI: nil,
            cpuUsage: nil,
            memoryUsage: nil,
            coldLaunch: nil,
            warmLaunch: nil,
            hotLaunch: nil,
            http: nil,
            networkChange: nil,
            customEvent: nil,
            screenView: nil,
            bugReport: nil,
            sessionStartData: nil,
            needsReporting: false
        )
    }

    private func makeSpan(id: String, sessionId: String) -> SpanEntity {
        let start: Int64 = 1
        let end: Int64 = 2

        return SpanEntity(
            name: "span",
            traceId: "trace",
            spanId: id,
            parentId: nil,
            sessionId: sessionId,
            startTime: start,
            startTimeString: "start",
            endTime: end,
            endTimeString: "end",
            duration: end - start,
            status: nil,
            attributes: nil,
            userDefinedAttrs: nil,
            checkpoints: nil,
            hasEnded: true,
            isSampled: true,
            batchId: nil
        )
    }

    func testSkipsExportWhenAlreadyRunning() {
        exporter.export()
        exporter.export()

        XCTAssertNil(network.lastBatchId)
    }

    func testExportsExistingBatch() {
        network.executeResponse = .success(body: nil, eTag: nil)

        let event = makeEvent(id: "e1", sessionId: "s1")
        eventStore.insertEvent(event: event)

        let batch = BatchEntity(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0)
        _ = batchStore.insertBatch(batch)

        let exp = expectation(description: "export")

        exporter.export()

        DispatchQueue.main.async {
            XCTAssertEqual(self.network.lastBatchId, "b1")
            exp.fulfill()
        }

        wait(for: [exp], timeout: 1)
    }

    func testDeletesBatchOnSuccess() {
        network.executeResponse = .success(body: nil, eTag: nil)

        let event = makeEvent(id: "e1", sessionId: "s1")
        eventStore.insertEvent(event: event)

        _ = batchStore.insertBatch(
            BatchEntity(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0)
        )

        let exp = expectation(description: "export")

        exporter.export()

        DispatchQueue.main.async {
            XCTAssertNil(self.batchStore.getBatch("b1"))
            XCTAssertEqual(self.eventStore.getEventsCount(), 0)
            exp.fulfill()
        }

        wait(for: [exp], timeout: 1)
    }

    func testDoesNotDeleteBatchOnServerError() {
        network.executeResponse = .error(.serverError(responseCode: 500, body: nil))

        let event = makeEvent(id: "e1", sessionId: "s1")
        eventStore.insertEvent(event: event)

        _ = batchStore.insertBatch(
            BatchEntity(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0)
        )

        let exp = expectation(description: "export")

        exporter.export()

        DispatchQueue.main.async {
            XCTAssertNotNil(self.batchStore.getBatch("b1"))
            XCTAssertEqual(self.eventStore.getEventsCount(), 1)
            exp.fulfill()
        }

        wait(for: [exp], timeout: 1)
    }

    func testUploadsAttachmentsAfterExport() {
        let json = """
        {"attachments":[{"id":"a1","type":"screenshot","filename":"layout_snapshot.png","upload_url":"https://example.com/a1","expires_at":"x","headers":{}}]}
        """

        network.executeResponse = .success(body: json, eTag: nil)
        http.uploadResponse = .success(body: nil, eTag: nil)

        let event = makeEvent(id: "e1", sessionId: "s1")
        eventStore.insertEvent(event: event)

        _ = batchStore.insertBatch(
            BatchEntity(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0)
        )

        let imageData = Data([1, 2, 3])
        let attachment = MsrUploadAttachment(
            id: "a1",
            name: "layout_snapshot.png",
            type: .screenshot,
            size: Number(imageData.count),
            bytes: imageData,
            path: nil,
            uploadUrl: nil,
            expiresAt: nil,
            headers: nil
        )

        attachmentStore.insert(attachment: attachment, sessionId: "e1")

        let exp = expectation(description: "export")

        exporter.export()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            XCTAssertEqual(self.http.uploadedUrls.first?.absoluteString, "https://example.com/a1")
            exp.fulfill()
        }

        wait(for: [exp], timeout: 1)
    }

    func testExportsExistingBatchesInOrder() {
        network.executeResponse = .success(body: nil, eTag: nil)
        
        eventStore.insertEvent(event: makeEvent(id: "e1", sessionId: "s1"))
        _ = batchStore.insertBatch(.init(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0))
        
        eventStore.insertEvent(event: makeEvent(id: "e2", sessionId: "s2"))
        _ = batchStore.insertBatch(.init(batchId: "b2", eventIds: ["e2"], spanIds: [], createdAt: 0))
        
        let exp = expectation(description: "export")
        
        exporter.export()
        
        DispatchQueue.main.async {
            XCTAssertEqual(self.network.executedBatchIds, ["b1", "b2"])
            exp.fulfill()
        }
        
        wait(for: [exp], timeout: 1)
    }
    
    func testExportsBatchWithEventsAndSpans() {
        network.executeResponse = .success(body: nil, eTag: nil)
        
        eventStore.insertEvent(event: makeEvent(id: "e1", sessionId: "s1"))
        spanStore.insertSpan(span: makeSpan(id: "sp1", sessionId: "s1"))
        
        _ = batchStore.insertBatch(.init(batchId: "b1", eventIds: ["e1"], spanIds: ["sp1"], createdAt: 0))
        
        let exp = expectation(description: "export")
        
        exporter.export()
        
        DispatchQueue.main.async {
            XCTAssertEqual(self.network.lastEvents.count, 1)
            XCTAssertEqual(self.network.lastSpans.count, 1)
            exp.fulfill()
        }
        
        wait(for: [exp], timeout: 1)
    }
    
    func testDeletesInvalidEmptyBatch() {
        _ = batchStore.insertBatch(.init(batchId: "b1", eventIds: [], spanIds: [], createdAt: 0))
        
        let exp = expectation(description: "export")
        
        exporter.export()
        
        DispatchQueue.main.async {
            XCTAssertNil(self.batchStore.getBatch("b1"))
            exp.fulfill()
        }
        
        wait(for: [exp], timeout: 1)
    }
    
    func testDeletesInvalidBatchWhenPacketsMissing() {
        _ = batchStore.insertBatch(.init(batchId: "b1", eventIds: ["ghost"], spanIds: ["ghost"], createdAt: 0))
        
        let exp = expectation(description: "export")
        
        exporter.export()
        
        DispatchQueue.main.async {
            XCTAssertNil(self.batchStore.getBatch("b1"))
            exp.fulfill()
        }
        
        wait(for: [exp], timeout: 1)
    }
    
    func testHandlesNilResponseBodyGracefully() {
        network.executeResponse = .success(body: nil, eTag: nil)
        
        eventStore.insertEvent(event: makeEvent(id: "e1", sessionId: "s1"))
        _ = batchStore.insertBatch(.init(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0))
        
        let exp = expectation(description: "export")
        
        exporter.export()
        
        DispatchQueue.main.async {
            XCTAssertNil(self.batchStore.getBatch("b1"))
            exp.fulfill()
        }
        
        wait(for: [exp], timeout: 1)
    }
    
    func testHandlesMalformedResponseBody() {
        network.executeResponse = .success(body: "nope", eTag: nil)
        
        eventStore.insertEvent(event: makeEvent(id: "e1", sessionId: "s1"))
        _ = batchStore.insertBatch(.init(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0))
        
        let exp = expectation(description: "export")
        
        exporter.export()
        
        DispatchQueue.main.async {
            XCTAssertNil(self.batchStore.getBatch("b1"))
            exp.fulfill()
        }
        
        wait(for: [exp], timeout: 1)
    }
    
    func testDeletesBatchOnClientError() {
        network.executeResponse = .error(.clientError(responseCode: 400, body: nil))
        
        eventStore.insertEvent(event: makeEvent(id: "e1", sessionId: "s1"))
        _ = batchStore.insertBatch(.init(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0))
        
        let exp = expectation(description: "export")
        
        exporter.export()
        
        DispatchQueue.main.async {
            XCTAssertNil(self.batchStore.getBatch("b1"))
            exp.fulfill()
        }
        
        wait(for: [exp], timeout: 1)
    }
    
    func testDoesNotDeleteBatchOnUnknownError() {
        network.executeResponse = .error(.unknownError("DummyError"))
        
        eventStore.insertEvent(event: makeEvent(id: "e1", sessionId: "s1"))
        _ = batchStore.insertBatch(.init(batchId: "b1", eventIds: ["e1"], spanIds: [], createdAt: 0))
        
        let exp = expectation(description: "export")
        
        exporter.export()
        
        DispatchQueue.main.async {
            XCTAssertNotNil(self.batchStore.getBatch("b1"))
            exp.fulfill()
        }
        
        wait(for: [exp], timeout: 1)
    }

    func testContentTypeForScreenshot() {
        let attachment = makeAttachment(type: .screenshot)
        XCTAssertEqual(attachment.contentType, screenshotContentType)
        XCTAssertNil(attachment.contentEncoding)
    }

    func testContentTypeForLayoutSnapshot() {
        let attachment = makeAttachment(type: .layoutSnapshot)
        XCTAssertEqual(attachment.contentType, layoutSnapshotContentType)
        XCTAssertNil(attachment.contentEncoding)
    }

    func testContentTypeAndEncodingForLayoutSnapshotJson() {
        let attachment = makeAttachment(type: .layoutSnapshotJson)
        XCTAssertEqual(attachment.contentType, layoutSnapshotJsonContentType)
        XCTAssertEqual(attachment.contentEncoding, layoutSnapshotJsonContentEncoding)
    }

    private func makeAttachment(type: AttachmentType) -> MsrUploadAttachment {
        MsrUploadAttachment(
            id: "test",
            name: "test",
            type: type,
            size: 0,
            bytes: nil,
            path: nil,
            uploadUrl: nil,
            expiresAt: nil,
            headers: nil
        )
    }
}
