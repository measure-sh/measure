//
//  InputStream+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/12/24.
//

import Foundation

extension InputStream {
    /// This extension adds a `readStream` method to the `InputStream` class, allowing you to read the contents of an `InputStream` as a `String`.
    /// - Returns: A String value for the inputStream
    func readStream() -> String {
        self.open()
        defer { self.close() }

        var buffer = [UInt8](repeating: 0, count: 1024)
        var output = ""

        while self.hasBytesAvailable {
            let length = self.read(&buffer, maxLength: buffer.count)
            if length > 0, let string = String(bytes: buffer[0..<length], encoding: .utf8) {
                output.append(string)
            }
        }

        return output
    }
}
