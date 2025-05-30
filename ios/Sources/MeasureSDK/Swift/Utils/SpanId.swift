/*
 * This file is copied from opentelemetry-swift
 * https://github.com/open-telemetry/opentelemetry-swift/blob/main/Sources/OpenTelemetryApi/Trace/SpanId.swift
 */

/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import Foundation

/// A struct that represents a span identifier. A valid span identifier is an 8-byte array with at
/// least one non-zero byte.
struct SpanId: Equatable, Comparable, Hashable, CustomStringConvertible, Codable {
  static let size = 8
  static let invalidId: UInt64 = 0
  static let invalid = SpanId(id: invalidId)

  // The internal representation of the SpanId.
  var id: UInt64 = invalidId

  static func getSize() -> Int {
    return size
  }

  /// Constructs a SpanId whose representation is specified by a long value.
  /// There is no restriction on the specified value, other than the already established validity
  /// rules applying to SpanId. Specifying 0 for this value will effectively make the new
  /// SpanId invalid.
  /// This is equivalent to calling fromBytes with the specified value
  /// stored as big-endian.
  /// - Parameter id: the UInt64 representation of the TraceId.
  init(id: UInt64) {
    self.id = id
  }

  // Returns an invalid SpanId. All bytes are 0.
  init() {}

  /// Generates a new random SpanId.
  static func random() -> SpanId {
    var id: UInt64
    repeat {
      id = UInt64.random(in: .min ... .max)
    } while id == invalidId

    return SpanId(id: id)
  }

  /// Returns a SpanId whose representation is copied from the data beginning at the offset.
  /// - Parameters:
  ///   - data: the buffer from where the representation of the SpanId is copied.
  ///   - offset: the offset in the buffer where the representation of the SpanId begins.
  init(fromData data: Data, withOffset offset: Int = 0) {
    var id: UInt64 = 0
    data.withUnsafeBytes { rawPointer in
      id = rawPointer.load(fromByteOffset: data.startIndex + offset, as: UInt64.self).bigEndian
    }
    self.init(id: id)
  }

  /// Returns a SpanId whose representation is copied from the data beginning at the offset.
  /// - Parameters:
  ///   - data: the buffer from where the representation of the SpanId is copied.
  ///   - offset: the offset in the buffer where the representation of the SpanId begins.
  init(fromBytes bytes: [UInt8], withOffset offset: Int = 0) {
    self.init(fromData: Data(bytes), withOffset: offset)
  }

  /// Returns a SpanId whose representation is copied from the data beginning at the offset.
  /// - Parameters:
  ///   - data: the byte array from where the representation of the SpanId is copied.
  ///   - offset: the offset in the buffer where the representation of the SpanId begins.
  init(fromBytes bytes: ArraySlice<UInt8>, withOffset offset: Int = 0) {
    self.init(fromData: Data(bytes), withOffset: offset)
  }

  /// Returns a SpanId whose representation is copied from the data beginning at the offset.
  /// - Parameters:
  ///   - data: the  char array slice from where the representation of the SpanId is copied.
  ///   - offset: the offset in the buffer where the representation of the SpanId begins.
  init(fromBytes bytes: ArraySlice<Character>, withOffset offset: Int = 0) {
    self.init(fromData: Data(String(bytes).utf8.map { UInt8($0) }))
  }

  /// Copies the byte array representations of the SpanId into the code dest beginning at the offset
  /// - Parameters:
  ///   - dest: the destination buffer.
  ///   - destOffset: the starting offset in the destination buffer.
  func copyBytesTo(dest: inout Data, destOffset: Int) {
    dest.replaceSubrange(destOffset ..< destOffset + MemoryLayout<UInt64>.size, with: withUnsafeBytes(of: id.bigEndian) { Array($0) })
  }

  /// Copies the byte array representations of the SpanId into the code dest beginning at the offset
  /// - Parameters:
  ///   - dest: the destination buffer.
  ///   - destOffset: the starting offset in the destination buffer.
  func copyBytesTo(dest: inout [UInt8], destOffset: Int) {
    dest.replaceSubrange(destOffset ..< destOffset + MemoryLayout<UInt64>.size, with: withUnsafeBytes(of: id.bigEndian) { Array($0) })
  }

  /// Copies the byte array representations of the SpanId into the code dest beginning at the offset
  /// - Parameters:
  ///   - dest: the destination buffer.
  ///   - destOffset: the starting offset in the destination buffer.
  func copyBytesTo(dest: inout ArraySlice<UInt8>, destOffset: Int) {
    dest.replaceSubrange(destOffset ..< destOffset + MemoryLayout<UInt64>.size, with: withUnsafeBytes(of: id.bigEndian) { Array($0) })
  }

  /// Returns a SpanId built from a lowercase base16 representation.
  /// - Parameters:
  ///   - hex: the lowercase base16 representation.
  ///   - offset: srcOffset the offset in the buffer where the representation of the SpanId begins.
  init(fromHexString hex: String, withOffset offset: Int = 0) {
    let firstIndex = hex.index(hex.startIndex, offsetBy: offset)
    let secondIndex = hex.index(firstIndex, offsetBy: 16)

    guard hex.count >= 16 + offset,
          let id = UInt64(hex[firstIndex ..< secondIndex], radix: 16) else {
      self.init()
      return
    }
    self.init(id: id)
  }

  ///  Returns the base16 encoding of this SpanId.
  var hexString: String {
    return String(format: "%016llx", id)
  }

  ///  Returns the raw id value of this SpanId.
  var rawValue: UInt64 {
    return id
  }

  /// Returns whether the span identifier is valid. A valid span identifier is an 8-byte array with
  /// at least one non-zero byte.
  var isValid: Bool {
    return id != SpanId.invalidId
  }

  var description: String {
    // return "SpanId{spanId=" + toLowerBase16() + "}";
    return "SpanId{spanId=\(hexString)}"
  }

  static func < (lhs: SpanId, rhs: SpanId) -> Bool {
    return lhs.id < rhs.id
  }

  static func == (lhs: SpanId, rhs: SpanId) -> Bool {
    return lhs.id == rhs.id
  }
}
