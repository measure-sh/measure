//
//  MockSystemFileManager.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 29/01/25.
//

import Foundation
@testable import Measure

final class MockSystemFileManager: SystemFileManager {
    var crashFilePath: URL?
    var directoryPath: String?
    var dynamicConfigPath: String?
    var savedFiles: [String: Data] = [:]
    var sdkDebugLogsDirectory: URL?
    var logFile: URL?
    var sdkDebugLogFiles: [URL] = []
    var deletedPaths: [String] = []

    func getCrashFilePath() -> URL? {
        return crashFilePath
    }

    func saveFile(data: Data, name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> URL? {
        let fileKey = folderName != nil ? "\(folderName!)/\(name)" : name
        savedFiles[fileKey] = data
        return URL(fileURLWithPath: fileKey)
    }

    func retrieveFile(name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> Data? {
        let fileKey = folderName != nil ? "\(folderName!)/\(name)" : name
        return savedFiles[fileKey]
    }

    func getDirectoryPath(directory: FileManager.SearchPathDirectory) -> String? {
        return directoryPath
    }

    func getDynamicConfigPath() -> String? {
        return dynamicConfigPath
    }

    func retrieveFile(atPath path: String) -> Data? {
        return savedFiles[path]
    }

    func deleteFile(atPath path: String) {
        savedFiles.removeValue(forKey: path)
        deletedPaths.append(path)
        sdkDebugLogFiles.removeAll { $0.path == path }
    }

    func getSdkDebugLogsDirectory() -> URL? {
        return sdkDebugLogsDirectory
    }

    func getLogFile(_ fileId: String) -> URL? {
        return logFile
    }

    func getContentsOfDebugLogsDirectory() -> [URL] {
        return sdkDebugLogFiles
    }
}
