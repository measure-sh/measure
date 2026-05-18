//
//  AttachmentProcessorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 14/05/26.
//

import XCTest
@testable import Measure

final class AttachmentProcessorTests: XCTestCase {
    private var sut: BaseAttachmentProcessor!
    private var mockFileManager: MockSystemFileManager!
    private var mockIdProvider: MockIdProvider!

    override func setUp() {
        super.setUp()
        mockFileManager = MockSystemFileManager()
        mockIdProvider = MockIdProvider()
        mockIdProvider.uuId = "test-uuid"
        sut = BaseAttachmentProcessor(
            logger: MockLogger(),
            fileManager: mockFileManager,
            idProvider: mockIdProvider
        )
    }

    override func tearDown() {
        sut = nil
        mockFileManager = nil
        mockIdProvider = nil
        super.tearDown()
    }

    func test_data_returnsBytesAndNilPath() {
        let attachment = sut.getAttachmentObject(for: Data("image".utf8),
                                                  storageType: .data,
                                                  attachmentType: .screenshot)

        XCTAssertNotNil(attachment?.bytes)
        XCTAssertNil(attachment?.path)
    }

    func test_fileStorage_savesToMeasureAttachmentsFolder() {
        let expectedFolder = "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.attachmentsFolderName)"

        _ = sut.getAttachmentObject(for: Data("image".utf8),
                                     storageType: .fileStorage,
                                     attachmentType: .screenshot)

        XCTAssertTrue(mockFileManager.savedFiles.keys.contains { $0.hasPrefix(expectedFolder) })
    }

    func test_fileStorage_returnsPathAndNilBytes() {
        let attachment = sut.getAttachmentObject(for: Data("image".utf8),
                                                  storageType: .fileStorage,
                                                  attachmentType: .screenshot)

        XCTAssertNotNil(attachment?.path)
        XCTAssertNil(attachment?.bytes)
    }

    func test_gzip_returnsBytesAndNilPath() {
        let attachment = sut.getAttachmentObject(for: Data("snapshot".utf8),
                                                  storageType: .gzip,
                                                  attachmentType: .layoutSnapshotJson)

        XCTAssertNotNil(attachment?.bytes)
        XCTAssertNil(attachment?.path)
    }
}
