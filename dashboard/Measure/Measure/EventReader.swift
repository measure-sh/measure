//
//  EventReader.swift
//  Measure
//
//  Created by Adwin Ross on 04/04/25.
//

import Foundation

class EventReader {
    static let shared = EventReader()
    private var fileHandle: FileHandle?
    private var source: DispatchSourceFileSystemObject?
    private let logPath = "/tmp/sdk_dashboard.log"

    func startMonitoring(onEvent: @escaping (String) -> Void) {
        let url = URL(fileURLWithPath: logPath)
        
        // Create the file if it doesn't exist
        if !FileManager.default.fileExists(atPath: logPath) {
            FileManager.default.createFile(atPath: logPath, contents: nil, attributes: nil)
        }

        guard let handle = try? FileHandle(forReadingFrom: url) else {
            print("❌ Failed to open log file for reading.")
            return
        }

        fileHandle = handle
        handle.seekToEndOfFile() // Start at the end, like `tail -f`

        let descriptor = handle.fileDescriptor
        source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: descriptor,
            eventMask: .write,
            queue: DispatchQueue.global()
        )

        source?.setEventHandler {
            let newData = handle.availableData
            if let string = String(data: newData, encoding: .utf8), !string.isEmpty {
                DispatchQueue.main.async {
                    string.split(separator: "\n").forEach { line in
                        onEvent(String(line))
                    }
                }
            }
        }

        source?.setCancelHandler {
            try? handle.close()
        }

        source?.resume()
        print("📖 Started monitoring log file")
    }

    func stopMonitoring() {
        source?.cancel()
        source = nil
        fileHandle = nil
    }
}
