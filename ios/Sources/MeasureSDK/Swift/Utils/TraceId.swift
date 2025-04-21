/*
 * This file is copied from opentelemetry-swift
 * https://github.com/open-telemetry/opentelemetry-swift/blob/main/Sources/OpenTelemetryApi/Trace/TraceId.swift
 */

/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import Foundation

/// A struct that represents a trace identifier. A valid trace identifier is a 16-byte array with at
/// least one non-zero byte.
struct TraceId: Comparable, Hashable, CustomStringConvertible, Equatable, Codable {
  static let size = 16
  static let invalidId: UInt64 = 0
  static let invalid = TraceId()

  // The internal representation of the TraceId.
  private(set) var idHi: UInt64 = invalidId
  private(set) var idLo: UInt64 = invalidId

  /// Constructs a TraceId whose representation is specified by two long values representing
  /// the lower and higher parts.
  /// There is no restriction on the specified values, other than the already established validity
  /// rules applying to TraceId. Specifying 0 for both values will effectively make the new
  /// TraceId invalid.
  /// This is equivalent to calling fromBytes() with the specified values
  /// stored as big-endian.
  /// - Parameters:
  ///   - idHi: the higher part of the TraceId
  ///   - idLo: the lower part of the TraceId
  init(idHi: UInt64, idLo: UInt64) {
    self.idHi = idHi
    self.idLo = idLo
  }

  /// Returns an invalid TraceId. All bytes are '\0'.
  init() {}

  /// Generates a new random TraceId.
  static func random() -> TraceId {
    var idHi: UInt64
    var idLo: UInt64
    repeat {
      idHi = UInt64.random(in: .min ... .max)
      idLo = UInt64.random(in: .min ... .max)
    } while idHi == TraceId.invalidId && idLo == TraceId.invalidId
    return TraceId(idHi: idHi, idLo: idLo)
  }

  /// Returns a TraceId whose representation is copied from the src beginning at the offset.
  /// - Parameter data: the data where the representation of the TraceId is copied.
  init(fromData data: Data) {
    var idHi: UInt64 = 0
    var idLo: UInt64 = 0
    data.withUnsafeBytes { rawPointer in
      idHi = rawPointer.load(fromByteOffset: data.startIndex, as: UInt64.self).bigEndian
      idLo = rawPointer.load(fromByteOffset: data.startIndex + MemoryLayout<UInt64>.size, as: UInt64.self).bigEndian
    }
    self.init(idHi: idHi, idLo: idLo)
  }

  /// Returns a TraceId whose representation is copied from the src beginning at the offset.
  /// - Parameter data: the byte array from where the representation of the TraceId is copied.
  init(fromBytes bytes: [UInt8]) {
    self.init(fromData: Data(bytes))
  }

  /// Returns a TraceId whose representation is copied from the src beginning at the offset.
  /// - Parameter data: the byte array slice from where the representation of the TraceId is copied.
  init(fromBytes bytes: ArraySlice<UInt8>) {
    self.init(fromData: Data(bytes))
  }

  /// Returns a TraceId whose representation is copied from the src beginning at the offset.
  /// - Parameter data: the char array from where the representation of the TraceId is copied.
  init(fromBytes bytes: ArraySlice<Character>) {
    self.init(fromData: Data(String(bytes).utf8.map { UInt8($0) }))
  }

  /// Copies the byte array representations of the TraceId into the dest beginning at
  /// the offset.
  /// - Parameters:
  ///   - dest: the destination buffer.
  ///   - destOffset: the starting offset in the destination buffer.
  func copyBytesTo(dest: inout Data, destOffset: Int) {
    dest.replaceSubrange(destOffset ..< destOffset + MemoryLayout<UInt64>.size,
                         with: withUnsafeBytes(of: idHi.bigEndian) { Array($0) })
    dest.replaceSubrange(destOffset + MemoryLayout<UInt64>.size ..< destOffset + MemoryLayout<UInt64>.size * 2,
                         with: withUnsafeBytes(of: idLo.bigEndian) { Array($0) })
  }

  /// Copies the byte array representations of the TraceId into the dest beginning at
  /// the offset.
  /// - Parameters:
  ///   - dest: the destination buffer.
  ///   - destOffset: the starting offset in the destination buffer.
  func copyBytesTo(dest: inout [UInt8], destOffset: Int) {
    dest.replaceSubrange(destOffset ..< destOffset + MemoryLayout<UInt64>.size,
                         with: withUnsafeBytes(of: idHi.bigEndian) { Array($0) })
    dest.replaceSubrange(destOffset + MemoryLayout<UInt64>.size ..< destOffset + MemoryLayout<UInt64>.size * 2,
                         with: withUnsafeBytes(of: idLo.bigEndian) { Array($0) })
  }

  /// Copies the byte array representations of the TraceId into the dest beginning at
  /// the offset.
  /// - Parameters:
  ///   - dest: the destination buffer.
  ///   - destOffset: the starting offset in the destination buffer.
  func copyBytesTo(dest: inout ArraySlice<UInt8>, destOffset: Int) {
    dest.replaceSubrange(destOffset ..< destOffset + MemoryLayout<UInt64>.size,
                         with: withUnsafeBytes(of: idHi.bigEndian) { Array($0) })
    dest.replaceSubrange(destOffset + MemoryLayout<UInt64>.size ..< destOffset + MemoryLayout<UInt64>.size * 2,
                         with: withUnsafeBytes(of: idLo.bigEndian) { Array($0) })
  }

  /// Returns a TraceId built from a lowercase base16 representation.
  /// - Parameters:
  ///   - hex: the lowercase base16 representation.
  ///   - offset: the offset in the buffer where the representation of the TraceId begins.
  init(fromHexString hex: String, withOffset offset: Int = 0) {
    if hex.count >= 32 + offset {
      let firstIndex = hex.index(hex.startIndex, offsetBy: offset)
      let secondIndex = hex.index(firstIndex, offsetBy: 16)
      let thirdIndex = hex.index(secondIndex, offsetBy: 16)
      if let idHi = UInt64(hex[firstIndex ..< secondIndex], radix: 16),
         let idLo = UInt64(hex[secondIndex ..< thirdIndex], radix: 16) {
        self.init(idHi: idHi, idLo: idLo)
        return
      }
    } else if hex.count >= 16 + offset {
      let firstIndex = hex.index(hex.startIndex, offsetBy: offset)
      let secondIndex = hex.index(firstIndex, offsetBy: 16)
      if let idLo = UInt64(hex[firstIndex ..< secondIndex], radix: 16) {
        self.init(idHi: 0, idLo: idLo)
        return
      }
    }
    self.init()
  }

  /// Returns whether the TraceId is valid. A valid trace identifier is a 16-byte array with
  /// at least one non-zero byte.
  var isValid: Bool {
    return idHi != TraceId.invalidId || idLo != TraceId.invalidId
  }

  /// Returns the lowercase base16 encoding of this TraceId.
  var hexString: String {
    return String(format: "%016llx%016llx", idHi, idLo)
  }

  /// Returns the lower 8 bytes of the trace-id as a long value, assuming little-endian order. This
  /// is used in ProbabilitySampler.
  var rawHigherLong: UInt64 {
    return idHi
  }

  /// Returns the lower 8 bytes of the trace-id as a long value, assuming little-endian order. This
  /// is used in ProbabilitySampler.
  var rawLowerLong: UInt64 {
    return idLo
  }

  var description: String {
    return "TraceId{traceId=\(hexString)}"
  }

  static func < (lhs: TraceId, rhs: TraceId) -> Bool {
    if lhs.idHi < rhs.idHi {
      return true
    } else if lhs.idHi == rhs.idHi, lhs.idLo < rhs.idLo {
      return true
    } else {
      return false
    }
  }

  static func == (lhs: TraceId, rhs: TraceId) -> Bool {
    return lhs.idHi == rhs.idHi && lhs.idLo == rhs.idLo
  }
}
