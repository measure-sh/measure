//
//  SystemFileManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/09/24.
//

import Foundation

/// A protocol that defines file system related operations.
protocol SystemFileManager {
    func getDirectoryPath(directory: FileManager.SearchPathDirectory) -> String?
    func getCrashFilePath() -> URL?
    func saveFile(data: Data, name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> URL?
    func retrieveFile(name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> Data?
}

final class BaseSystemFileManager: SystemFileManager {
    private let logger: Logger
    private let fileManager: FileManager
    private var cacheDirectory: URL? {
        guard let cacheDirectory = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            logger.internalLog(level: .error, message: "Unable to access cache directory", error: nil, data: nil)
            return nil
        }
        return cacheDirectory.appendingPathComponent(cacheDirectoryName)
    }

    init(logger: Logger) {
        self.logger = logger
        self.fileManager = FileManager.default
    }

    func getCrashFilePath() -> URL? {
        guard let crashReportDirectory = cacheDirectory else { return nil }
        do {
            if !fileManager.fileExists(atPath: crashReportDirectory.path) {
                try fileManager.createDirectory(at: crashReportDirectory, withIntermediateDirectories: true, attributes: nil)
            }
        } catch {
            logger.internalLog(level: .error, message: "Failed to create crash report directory.", error: error, data: nil)
            return nil
        }
        return crashReportDirectory.appendingPathComponent(crashDataFileName)
    }

    func saveFile(data: Data, name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> URL? {
        guard let directoryURL = fileManager.urls(for: directory, in: .userDomainMask).first else {
            logger.internalLog(level: .error, message: "Unable to access directory \(directory)", error: nil, data: nil)
            return nil
        }

        // Append the folder name if provided
        let folderURL = folderName != nil ? directoryURL.appendingPathComponent(folderName!) : directoryURL

        // Create the folder if it doesn't exist
        if folderName != nil, !fileManager.fileExists(atPath: folderURL.path) {
            do {
                try fileManager.createDirectory(at: folderURL, withIntermediateDirectories: true, attributes: nil)
            } catch {
                logger.internalLog(level: .error, message: "Failed to create folder \(folderName!) in directory \(directory)", error: error, data: nil)
                return nil
            }
        }

        let fileURL = folderURL.appendingPathComponent(name)

        if fileManager.fileExists(atPath: fileURL.path) {
            do {
                try fileManager.removeItem(at: fileURL)
            } catch {
                logger.internalLog(level: .error, message: "Failed to remove existing file \(name) in folder \(folderName ?? "root")", error: error, data: nil)
                return nil
            }
        }

        do {
            try data.write(to: fileURL, options: .atomic)
            return fileURL
        } catch {
            logger.internalLog(level: .error, message: "Failed to save file \(name) to folder \(folderName ?? "root") in directory \(directory)", error: error, data: nil)
            return nil
        }
    }

    func retrieveFile(name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> Data? {
        guard let directoryURL = fileManager.urls(for: directory, in: .userDomainMask).first else {
            logger.internalLog(level: .error, message: "Unable to access directory \(directory)", error: nil, data: nil)
            return nil
        }

        let folderURL = folderName != nil ? directoryURL.appendingPathComponent(folderName!) : directoryURL
        let fileURL = folderURL.appendingPathComponent(name)

        do {
            let data = try Data(contentsOf: fileURL)
            return data
        } catch {
            logger.internalLog(level: .error, message: "Failed to retrieve file \(name) from folder \(folderName ?? "root") in directory \(directory)", error: error, data: nil)
            return nil
        }
    }
    
    func getDirectoryPath(directory: FileManager.SearchPathDirectory) -> String? {
        guard let directoryURL = fileManager.urls(for: directory, in: .userDomainMask).first else {
            logger.internalLog(level: .error, message: "Unable to access directory \(directory)", error: nil, data: nil)
            return nil
        }
        return directoryURL.path
    }
}
