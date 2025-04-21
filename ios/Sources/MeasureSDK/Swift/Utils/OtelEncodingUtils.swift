//
//  OtelEncodingUtils.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/08/24.
//

import Foundation

/// Utility class for encoding and decoding span IDs and trace IDs.
/// This class encapsulates the core logic for encoding/decoding span ID and trace ID.
/// We use this directly as it generates otel-compatible IDs and is well optimized.
final class OtelEncodingUtils {
    /// Number of bytes in a Long (Int64)
    static let longBytes = MemoryLayout<Int64>.size

    /// Number of characters in base16 representation of a byte
    static let byteBase16 = 2

    /// Number of characters in base16 representation of a Long (Int64)
    static let longBase16 = byteBase16 * longBytes

    /// Alphabet for base16 encoding
    private static let alphabet = "0123456789abcdef"

    /// Maximum ASCII character value
    private static let numAsciiCharacters = 128

    /// Encoding array for base16 conversion
    private static let encoding: [Character] = buildEncodingArray()

    /// Decoding array for base16 conversion
    private static let decoding: [Int8] = buildDecodingArray()

    /// Array indicating valid hex characters
    private static let validHex: [Bool] = buildValidHexArray()

    /// Builds the encoding array for base16 conversion
    private static func buildEncodingArray() -> [Character] {
        var encoding = [Character](repeating: "0", count: 512)
        for i in 0..<256 { // swiftlint:disable:this identifier_name
            encoding[i] = alphabet[alphabet.index(alphabet.startIndex, offsetBy: i >> 4)]
            encoding[i | 0x100] = alphabet[alphabet.index(alphabet.startIndex, offsetBy: i & 0xF)]
        }
        return encoding
    }

    /// Builds the decoding array for base16 conversion
    private static func buildDecodingArray() -> [Int8] {
        var decoding = [Int8](repeating: -1, count: numAsciiCharacters)
        for i in 0..<alphabet.count { // swiftlint:disable:this identifier_name
            let char = alphabet[alphabet.index(alphabet.startIndex, offsetBy: i)]
            decoding[Int(char.asciiValue!)] = Int8(i)
        }
        return decoding
    }

    /// Builds the array indicating valid hex characters
    private static func buildValidHexArray() -> [Bool] {
        // In Swift, we'll use a more direct approach for hex validation
        // We only need to check ASCII values 0-127 for our use case
        var validHex = [Bool](repeating: false, count: numAsciiCharacters)

        // Mark digits 0-9 as valid (ASCII 48-57)
        for i in 48...57 { // swiftlint:disable:this identifier_name
            validHex[i] = true
        }

        // Mark hex letters a-f as valid (ASCII 97-102)
        for i in 97...102 { // swiftlint:disable:this identifier_name
            validHex[i] = true
        }

        return validHex
    }

    /// Returns the Int64 value whose base16 representation is stored in the first 16 chars of the string
    /// starting from the offset.
    ///
    /// - Parameters:
    ///   - chars: The base16 representation of the Int64
    ///   - offset: The starting offset in the string
    /// - Returns: The decoded Int64 value
    static func longFromBase16String(_ chars: String, offset: Int) -> Int64 {
        let startIndex = chars.index(chars.startIndex, offsetBy: offset)
        let endIndex = chars.index(startIndex, offsetBy: 16)
        let substring = chars[startIndex..<endIndex]

        var result: Int64 = 0
        for i in 0..<8 { // swiftlint:disable:this identifier_name
            let byteOffset = i * 2
            let firstChar = substring[substring.index(substring.startIndex, offsetBy: byteOffset)]
            let secondChar = substring[substring.index(substring.startIndex, offsetBy: byteOffset + 1)]
            let byte = byteFromBase16(firstChar, secondChar)
            result = (result << 8) | Int64(byte & 0xFF)
        }
        return result
    }

    /// Appends the base16 encoding of the specified value to the destination array.
    ///
    /// - Parameters:
    ///   - value: The value to be converted
    ///   - dest: The destination character array
    ///   - destOffset: The starting offset in the destination array
    static func longToBase16String(_ value: Int64, dest: inout [Character], destOffset: Int) {
        byteToBase16(UInt8((value >> 56) & 0xFF), dest: &dest, destOffset: destOffset)
        byteToBase16(UInt8((value >> 48) & 0xFF), dest: &dest, destOffset: destOffset + byteBase16)
        byteToBase16(UInt8((value >> 40) & 0xFF), dest: &dest, destOffset: destOffset + 2 * byteBase16)
        byteToBase16(UInt8((value >> 32) & 0xFF), dest: &dest, destOffset: destOffset + 3 * byteBase16)
        byteToBase16(UInt8((value >> 24) & 0xFF), dest: &dest, destOffset: destOffset + 4 * byteBase16)
        byteToBase16(UInt8((value >> 16) & 0xFF), dest: &dest, destOffset: destOffset + 5 * byteBase16)
        byteToBase16(UInt8((value >> 8) & 0xFF), dest: &dest, destOffset: destOffset + 6 * byteBase16)
        byteToBase16(UInt8(value & 0xFF), dest: &dest, destOffset: destOffset + 7 * byteBase16)
    }

    /// Returns the bytes decoded from the given hex string.
    ///
    /// - Parameters:
    ///   - value: The hex string to decode
    ///   - length: The length of the hex string
    /// - Returns: The decoded bytes
    static func bytesFromBase16(_ value: String, length: Int) -> [UInt8] {
        var result = [UInt8](repeating: 0, count: length / 2)
        bytesFromBase16(value, length: length, bytes: &result)
        return result
    }

    /// Fills the bytes array with bytes decoded from the given hex string.
    ///
    /// - Parameters:
    ///   - value: The hex string to decode
    ///   - length: The length of the hex string
    ///   - bytes: The array to fill with decoded bytes
    static func bytesFromBase16(_ value: String, length: Int, bytes: inout [UInt8]) {
        for i in stride(from: 0, to: length, by: 2) { // swiftlint:disable:this identifier_name
            let firstChar = value[value.index(value.startIndex, offsetBy: i)]
            let secondChar = value[value.index(value.startIndex, offsetBy: i + 1)]
            bytes[i / 2] = byteFromBase16(firstChar, secondChar)
        }
    }

    /// Fills the destination array with the hex encoding of the bytes.
    ///
    /// - Parameters:
    ///   - bytes: The bytes to encode
    ///   - dest: The destination character array
    ///   - length: The length of the bytes array
    static func bytesToBase16(_ bytes: [UInt8], dest: inout [Character], length: Int) {
        for i in 0..<length { // swiftlint:disable:this identifier_name
            byteToBase16(bytes[i], dest: &dest, destOffset: i * 2)
        }
    }

    /// Encodes the specified byte and stores it in the destination array.
    ///
    /// - Parameters:
    ///   - value: The byte to encode
    ///   - dest: The destination character array
    ///   - destOffset: The starting offset in the destination array
    static func byteToBase16(_ value: UInt8, dest: inout [Character], destOffset: Int) {
        let b = Int(value) // swiftlint:disable:this identifier_name
        dest[destOffset] = encoding[b]
        dest[destOffset + 1] = encoding[b | 0x100]
    }

    /// Decodes the specified two character sequence and returns the resulting byte.
    ///
    /// - Parameters:
    ///   - first: The first hex character
    ///   - second: The second hex character
    /// - Returns: The decoded byte
    static func byteFromBase16(_ first: Character, _ second: Character) -> UInt8 {
        guard let firstAscii = first.asciiValue, firstAscii < numAsciiCharacters, decoding[Int(firstAscii)] != -1 else {
            fatalError("invalid character \(first)")
        }

        guard let secondAscii = second.asciiValue, secondAscii < numAsciiCharacters, decoding[Int(secondAscii)] != -1 else {
            fatalError("invalid character \(second)")
        }

        let decoded = (Int(decoding[Int(firstAscii)]) << 4) | Int(decoding[Int(secondAscii)])
        return UInt8(decoded)
    }

    /// Returns whether the string is a valid hex string.
    ///
    /// - Parameter value: The string to check
    /// - Returns: True if the string is a valid hex string, false otherwise
    static func isValidBase16String(_ value: String) -> Bool {
        value.allSatisfy(isValidBase16Character)
    }

    /// Returns whether the given character is a valid hex character.
    ///
    /// - Parameter char: The character to check
    /// - Returns: True if the character is a valid hex character, false otherwise
    static func isValidBase16Character(_ char: Character) -> Bool {
        guard let asciiValue = char.asciiValue else {
            return false
        }
        return validHex[Int(asciiValue)]
    }

    /// Private initializer to prevent instantiation
    private init() {}
}
