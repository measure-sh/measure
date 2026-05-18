//
//  SystemFileManagerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 14/05/26.
//

import XCTest
@testable import Measure

final class SystemFileManagerTests: XCTestCase {
    private var sut: BaseSystemFileManager!
    private var measureURL: URL!

    override func setUp() {
        super.setUp()
        sut = BaseSystemFileManager(logger: MockLogger())
        let appSupportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        measureURL = appSupportURL.appendingPathComponent(ConfigFileConstants.folderName)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: measureURL)
        sut = nil
        super.tearDown()
    }

    func test_getCrashFilePath_returnsPathUnderMeasureCrashDataFolder() {
        let expected = measureURL
            .appendingPathComponent(ConfigFileConstants.crashDataFolderName)
            .appendingPathComponent(crashDataFileName)

        XCTAssertEqual(sut.getCrashFilePath(), expected)
    }

    func test_getCrashFilePath_createsCrashDataDirectory() {
        _ = sut.getCrashFilePath()

        let crashDir = measureURL.appendingPathComponent(ConfigFileConstants.crashDataFolderName)
        XCTAssertTrue(FileManager.default.fileExists(atPath: crashDir.path))
    }

    func test_getDynamicConfigPath_returnsPathUnderMeasureDynamicConfigFolder() {
        let expected = measureURL
            .appendingPathComponent(ConfigFileConstants.dynamicConfigFolderName)
            .appendingPathComponent(ConfigFileConstants.fileName)
            .path

        XCTAssertEqual(sut.getDynamicConfigPath(), expected)
    }

    func test_getAttachmentDirectoryPath_returnsPathUnderMeasureAttachmentsFolder() {
        let expected = measureURL
            .appendingPathComponent(ConfigFileConstants.attachmentsFolderName)
            .path

        XCTAssertEqual(sut.getAttachmentDirectoryPath(), expected)
    }

    func test_getAttachmentDirectoryPath_createsDirectoryIfAbsent() {
        _ = sut.getAttachmentDirectoryPath()

        let attachmentsDir = measureURL.appendingPathComponent(ConfigFileConstants.attachmentsFolderName)
        XCTAssertTrue(FileManager.default.fileExists(atPath: attachmentsDir.path))
    }

    func test_getAttachmentDirectoryPath_returnsNil_whenDirectoryCreationFails() throws {
        // Place a file at measureURL so createDirectory for the attachments subfolder fails
        let appSupportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try FileManager.default.createDirectory(at: appSupportURL, withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: measureURL.path, contents: nil)

        XCTAssertNil(sut.getAttachmentDirectoryPath())
    }

    func test_getAttachmentDirectoryPath_isIdempotent() {
        let first = sut.getAttachmentDirectoryPath()
        let second = sut.getAttachmentDirectoryPath()

        XCTAssertNotNil(first)
        XCTAssertEqual(first, second)
    }

    func test_getSdkDebugLogsDirectory_returnsPathUnderMeasureSdkDebugLogsFolder() {
        let expected = measureURL.appendingPathComponent(ConfigFileConstants.sdkDebugLogsFolderName)

        XCTAssertEqual(sut.getSdkDebugLogsDirectory(), expected)
    }

    func test_allPaths_areRootedUnderApplicationSupportMeasure() {
        let expectedRoot = measureURL.path

        XCTAssertTrue(sut.getCrashFilePath()!.path.hasPrefix(expectedRoot))
        XCTAssertTrue(sut.getDynamicConfigPath()!.hasPrefix(expectedRoot))
        XCTAssertTrue(sut.getAttachmentDirectoryPath()!.hasPrefix(expectedRoot))
        XCTAssertTrue(sut.getSdkDebugLogsDirectory()!.path.hasPrefix(expectedRoot))
    }
}
