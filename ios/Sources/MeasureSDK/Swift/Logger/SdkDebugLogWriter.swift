//
//  SdkDebugLogWriter.swift
//  MeasureSDK
//

import Foundation

/// Writes SDK diagnostic logs to a file on disk. Logs are buffered in memory and flushed every 3 seconds
/// on a background serial queue. The file handle is kept open for the lifetime of the writer.
///
/// Thread safety: writeLog() can be called from any thread. The buffer is dispatched to the serial queue.
/// All file I/O runs exclusively on the serial queue.
final class SdkDebugLogWriter {
    private let queue: DispatchQueue
    private var buffer: [LogEntry] = []
    private var fileHandle: FileHandle?
    private var timer: DispatchSourceTimer?

    init(queue: DispatchQueue = DispatchQueue(label: "sh.measure.sdk.diag", qos: .background)) {
        self.queue = queue
    }

    func start(sdkVersion: String, timestamp: Int64, logsDir: URL) {
        queue.async { [weak self] in
            guard let self else { return }
            do {
                if !FileManager.default.fileExists(atPath: logsDir.path) {
                    try FileManager.default.createDirectory(at: logsDir, withIntermediateDirectories: true, attributes: nil)
                }
                let fileURL = logsDir.appendingPathComponent("\(timestamp)")
                FileManager.default.createFile(atPath: fileURL.path, contents: nil, attributes: nil)
                self.fileHandle = try FileHandle(forWritingTo: fileURL)
                let header = "\(sdkVersion) \(timestamp)\n"
                if let data = header.data(using: .utf8) {
                    self.fileHandle?.write(data)
                }
            } catch {
                // Silently ignore -- never break SDK init
            }
        }

        let t = DispatchSource.makeTimerSource(queue: queue)
        t.schedule(deadline: .now() + 3, repeating: 3)
        t.setEventHandler { [weak self] in self?.flush() }
        t.resume()
        timer = t
    }

    func writeLog(level: LogLevel, message: String, error: Error?) {
        queue.async { [weak self] in
            self?.buffer.append(LogEntry(level: level, message: message, error: error))
        }
    }

    func flush() {
        // Called on queue
        guard !buffer.isEmpty, let handle = fileHandle else { return }
        let entries = buffer
        buffer.removeAll()
        var output = ""
        for entry in entries {
            output += "\(entry.level.rawValue) \(entry.message)"
            if let error = entry.error {
                output += " \(error.localizedDescription)"
            }
            output += "\n"
        }
        if let data = output.data(using: .utf8) {
            handle.write(data)
        }
    }

    private struct LogEntry {
        let level: LogLevel
        let message: String
        let error: Error?
    }
}
