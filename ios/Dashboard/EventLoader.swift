//
//  EventLoader.swift
//  Dashboard
//
//  Created by Adwin Ross on 04/04/25.
//

import Foundation
import Combine

// Type-erased codable to support generic event decoding
struct AnyCodable: Codable {}

extension Event: Identifiable where T == AnyCodable {}

class EventLoader: ObservableObject {
    @Published var events: [Event<AnyCodable>] = []

    private let logFilePath = "/tmp/measure_sdk_events.txt"
    private var lastReadOffset: UInt64 = 0
    private var timer: Timer?

    init() {
        startReading()
    }

    func startReading() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.readNewLines()
        }
    }

    func stopReading() {
        timer?.invalidate()
        timer = nil
    }

    private func readNewLines() {
        DispatchQueue.global(qos: .utility).async {
            guard FileManager.default.fileExists(atPath: self.logFilePath),
                  FileManager.default.isReadableFile(atPath: self.logFilePath),
                  let handle = FileHandle(forReadingAtPath: self.logFilePath) else {
                print("❌ File not accessible at path: \(self.logFilePath)")
                return
            }

            defer { try? handle.close() }

            do {
                try handle.seek(toOffset: self.lastReadOffset)
            } catch {
                print("❌ Failed to seek file: \(error.localizedDescription)")
                return
            }

            let data = handle.readDataToEndOfFile()
            self.lastReadOffset = handle.offsetInFile

            guard let content = String(data: data, encoding: .utf8) else {
                print("❌ Could not decode log data to UTF-8 string.")
                return
            }

            let newLines = content.split(separator: "\n")

            DispatchQueue.main.async {
                for line in newLines {
                    if let lineData = line.data(using: .utf8) {
                        do {
                            let event = try JSONDecoder().decode(Event<AnyCodable>.self, from: lineData)
                            self.events.insert(event, at: 0)
                        } catch {
                            print("❌ Failed to decode event JSON: \(error.localizedDescription)")
                            print("🔍 Offending line: \(line)")
                        }
                    }
                }
            }
        }
    }
}
