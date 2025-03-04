//
//  MockSystemFileManager.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 29/01/25.
//

import Foundation
@testable import MeasureSDK

final class MockSystemFileManager: SystemFileManager {
    var crashFilePath: URL?
    var savedFiles: [String: Data] = [:]

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
}
