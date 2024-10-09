//
//  SystemFileManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/09/24.
//

import Foundation

/// A protocol that defines file system related operations.
protocol SystemFileManager {
    func getCrashFilePath() -> URL?
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
}
