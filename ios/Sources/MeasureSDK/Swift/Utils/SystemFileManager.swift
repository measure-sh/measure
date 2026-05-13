//
//  SystemFileManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/09/24.
//

import Foundation

enum ConfigFileConstants {
    static let fileName = "dynamic_config.json"
    static let folderName = "measure"
    static let directory: FileManager.SearchPathDirectory = .applicationSupportDirectory
    static let sdkDebugLogsFolderName = "sdk_debug_logs"
    static let crashDataFolderName = "crash_data"
    static let dynamicConfigFolderName = "dynamic_config"
    static let attachmentsFolderName = "attachments"
}

/// A protocol that defines file system related operations.
protocol SystemFileManager {
    func getDirectoryPath(directory: FileManager.SearchPathDirectory) -> String?
    func getAttachmentDirectoryPath() -> String?
    func getCrashFilePath() -> URL?
    func saveFile(data: Data, name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> URL?
    func retrieveFile(name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> Data?
    func getDynamicConfigPath() -> String?
    func retrieveFile(atPath path: String) -> Data?
    func deleteFile(atPath path: String)
    func getSdkDebugLogsDirectory() -> URL?
    func getLogFile(_ fileId: String) -> URL?
    func getContentsOfDebugLogsDirectory() -> [URL]
}

final class BaseSystemFileManager: SystemFileManager {
    private let logger: Logger
    private let fileManager: FileManager
    private var measureDirectory: URL? {
        guard let appSupportDirectory = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            logger.internalLog(level: .error, message: "SystemFileManager: Unable to access application support directory", error: nil, data: nil)
            return nil
        }
        return appSupportDirectory.appendingPathComponent(ConfigFileConstants.folderName)
    }
    init(logger: Logger) {
        self.logger = logger
        self.fileManager = FileManager.default
    }

    func getCrashFilePath() -> URL? {
        guard let measureDir = measureDirectory else { return nil }
        let crashDir = measureDir.appendingPathComponent(ConfigFileConstants.crashDataFolderName)
        do {
            if !fileManager.fileExists(atPath: crashDir.path) {
                try fileManager.createDirectory(at: crashDir, withIntermediateDirectories: true, attributes: nil)
            }
        } catch {
            logger.internalLog(level: .error, message: "SystemFileManager: Failed to create crash report directory.", error: error, data: nil)
            return nil
        }
        let newCrashPath = crashDir.appendingPathComponent(crashDataFileName)
        if !fileManager.fileExists(atPath: newCrashPath.path),
           let oldCrashPath = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first?
               .appendingPathComponent(cacheDirectoryName)
               .appendingPathComponent(crashDataFileName),
           fileManager.fileExists(atPath: oldCrashPath.path) {
            try? fileManager.moveItem(at: oldCrashPath, to: newCrashPath)
        }
        return newCrashPath
    }

    func saveFile(data: Data, name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> URL? {
        guard let directoryURL = fileManager.urls(for: directory, in: .userDomainMask).first else {
            logger.internalLog(level: .error, message: "SystemFileManager: Unable to access directory \(directory)", error: nil, data: nil)
            return nil
        }

        // Append the folder name if provided
        let folderURL = folderName != nil ? directoryURL.appendingPathComponent(folderName!) : directoryURL

        // Create the folder if it doesn't exist
        if folderName != nil, !fileManager.fileExists(atPath: folderURL.path) {
            do {
                try fileManager.createDirectory(at: folderURL, withIntermediateDirectories: true, attributes: nil)
            } catch {
                logger.internalLog(level: .error, message: "SystemFileManager: Failed to create folder \(folderName!) in directory \(directory)", error: error, data: nil)
                return nil
            }
        }

        let fileURL = folderURL.appendingPathComponent(name)

        if fileManager.fileExists(atPath: fileURL.path) {
            do {
                try fileManager.removeItem(at: fileURL)
            } catch {
                logger.internalLog(level: .error, message: "SystemFileManager: Failed to remove existing file \(name) in folder \(folderName ?? "root")", error: error, data: nil)
                return nil
            }
        }

        do {
            try data.write(to: fileURL, options: .atomic)
            return fileURL
        } catch {
            logger.internalLog(level: .error, message: "SystemFileManager: Failed to save file \(name) to folder \(folderName ?? "root") in directory \(directory)", error: error, data: nil)
            return nil
        }
    }

    func retrieveFile(name: String, folderName: String?, directory: FileManager.SearchPathDirectory) -> Data? {
        guard let directoryURL = fileManager.urls(for: directory, in: .userDomainMask).first else {
            logger.internalLog(level: .error, message: "SystemFileManager: Unable to access directory \(directory)", error: nil, data: nil)
            return nil
        }

        let folderURL = folderName != nil ? directoryURL.appendingPathComponent(folderName!) : directoryURL
        let fileURL = folderURL.appendingPathComponent(name)

        do {
            let data = try Data(contentsOf: fileURL)
            return data
        } catch {
            logger.internalLog(level: .error, message: "SystemFileManager: Failed to retrieve file \(name) from folder \(folderName ?? "root") in directory \(directory)", error: error, data: nil)
            return nil
        }
    }

    func getDirectoryPath(directory: FileManager.SearchPathDirectory) -> String? {
        guard let directoryURL = fileManager.urls(for: directory, in: .userDomainMask).first else {
            logger.internalLog(level: .error, message: "SystemFileManager: Unable to access directory \(directory)", error: nil, data: nil)
            return nil
        }
        return directoryURL.path
    }

    func getAttachmentDirectoryPath() -> String? {
        guard let attachmentsDir = measureDirectory?.appendingPathComponent(ConfigFileConstants.attachmentsFolderName) else { return nil }
        if !fileManager.fileExists(atPath: attachmentsDir.path) {
            do {
                try fileManager.createDirectory(at: attachmentsDir, withIntermediateDirectories: true, attributes: nil)
            } catch {
                logger.internalLog(level: .error, message: "SystemFileManager: Failed to create attachments directory", error: error, data: nil)
                return nil
            }
        }
        return attachmentsDir.path
    }

    func getDynamicConfigPath() -> String? {
        return measureDirectory?
            .appendingPathComponent(ConfigFileConstants.dynamicConfigFolderName)
            .appendingPathComponent(ConfigFileConstants.fileName)
            .path
    }
    
    func retrieveFile(atPath path: String) -> Data? {
        let fileURL = URL(fileURLWithPath: path)

        guard fileManager.fileExists(atPath: fileURL.path) else {
            logger.internalLog(level: .error,
                message: "SystemFileManager: File does not exist at path \(path)",
                error: nil,
                data: nil
            )
            return nil
        }

        do {
            return try Data(contentsOf: fileURL)
        } catch {
            logger.internalLog(
                level: .error,
                message: "SystemFileManager: Failed to retrieve file at path \(path)",
                error: error,
                data: nil
            )
            return nil
        }
    }

    func deleteFile(atPath path: String) {
        let fileURL = URL(fileURLWithPath: path)

        guard fileManager.fileExists(atPath: fileURL.path) else { return }

        do {
            try fileManager.removeItem(at: fileURL)
        } catch {
            logger.internalLog(
                level: .error,
                message: "SystemFileManager: Failed to delete file at path \(path)",
                error: error,
                data: nil
            )
        }
    }

    func getSdkDebugLogsDirectory() -> URL? {
        guard let measureDir = measureDirectory else { return nil }

        let debugLogsDirectory = measureDir.appendingPathComponent(ConfigFileConstants.sdkDebugLogsFolderName)

        if !fileManager.fileExists(atPath: debugLogsDirectory.path) {
            do {
                try fileManager.createDirectory(at: debugLogsDirectory, withIntermediateDirectories: true, attributes: nil)
            } catch {
                logger.internalLog(level: .error, message: "SystemFileManager: Failed to create sdk_debug_logs directory", error: error, data: nil)
                return nil
            }
        }

        return debugLogsDirectory
    }

    func getLogFile(_ fileId: String) -> URL? {
        guard let debugLogsDir = getSdkDebugLogsDirectory() else { return nil }

        let fileURL = debugLogsDir.appendingPathComponent(fileId)

        if !fileManager.fileExists(atPath: fileURL.path) {
            guard fileManager.createFile(atPath: fileURL.path, contents: nil) else {
                logger.internalLog(level: .error, message: "SystemFileManager: Failed to create log file \(fileId)", error: nil, data: nil)
                return nil
            }
        }

        return fileURL
    }

    func getContentsOfDebugLogsDirectory() -> [URL] {
        guard let dir = getSdkDebugLogsDirectory() else { return [] }
        do {
            return try fileManager.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
        } catch {
            logger.internalLog(level: .error, message: "SystemFileManager: Failed to list sdk_debug_logs directory", error: error, data: nil)
            return []
        }
    }
}
