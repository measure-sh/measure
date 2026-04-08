//
//  SdkDebugLogWriter.swift
//  Measure
//
//  Created by Adwin Ross on 30/03/26.
//

import Foundation

/// Writes SDK debug logs to a file. Logs are buffered in memory and flushed to disk every 3 seconds
/// on the IO dispatch queue. The file handle is kept open for the lifetime of the writer.
///
/// Thread safety: `writeLog` can be called from any thread. The buffer is guarded by `lock`.
/// All file I/O (including `fileHandle` access) runs exclusively on the single-threaded `ioQueue`.
final class SdkDebugLogWriter {
    private let fileManager: SystemFileManager
    private let sdkVersion: String
    private let fileId: String
    private let timeProvider: TimeProvider
    private let measureDispatchQueue: MeasureDispatchQueue

    private var buffer: [LogEntry] = []
    private let lock = NSLock()

    private var fileHandle: FileHandle?

    init(fileManager: SystemFileManager,
         sdkVersion: String,
         fileId: String,
         timeProvider: TimeProvider,
         measureDispatchQueue: MeasureDispatchQueue) {
        self.fileManager = fileManager
        self.sdkVersion = sdkVersion
        self.fileId = fileId
        self.timeProvider = timeProvider
        self.measureDispatchQueue = measureDispatchQueue
    }

    func start() {
        measureDispatchQueue.submit {
            guard let fileURL = self.fileManager.getLogFile(self.fileId) else { return }
            do {
                self.fileHandle = try FileHandle(forWritingTo: fileURL)
                let header = "Measure SDK Version: \(self.sdkVersion)\n"
                if let data = header.data(using: .utf8) {
                    self.fileHandle?.write(data)
                }
            } catch {}
        }

        scheduleFlush()
    }

    func writeLog(level: LogLevel, message: String, error: Error?) {
        lock.lock()
        buffer.append(LogEntry(level: level,
                               message: message,
                               error: error,
                               timestamp: timeProvider.iso8601Timestamp(timeInMillis: timeProvider.now())))
        lock.unlock()
    }

    func close() {
        measureDispatchQueue.submitSync {
            self.flushBuffer()
            self.fileHandle?.closeFile()
            self.fileHandle = nil
        }
    }

    private func scheduleFlush() {
        measureDispatchQueue.schedule(after: 3.0) { [weak self] in
            guard let self else { return }
            self.flushBuffer()
            self.scheduleFlush()
        }
    }

    private func flushBuffer() {
        lock.lock()
        guard !buffer.isEmpty else {
            lock.unlock()
            return
        }
        let entries = buffer
        buffer.removeAll()
        lock.unlock()

        guard let handle = fileHandle else { return }
        do {
            var output = ""
            for entry in entries {
                output += "\(entry.timestamp) \(entry.level.rawValue) \(entry.message)"
                if let error = entry.error {
                    output += " \(error)"
                }
                output += "\n"
            }
            if let data = output.data(using: .utf8) {
                handle.write(data)
            }
        }
    }

    private struct LogEntry {
        let level: LogLevel
        let message: String
        let error: Error?
        let timestamp: String
    }
}
