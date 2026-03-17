//
//  Data+Extension.swift
//  Measure
//
//  Created by Adwin Ross on 17/03/26.
//

import Foundation
import zlib

extension Data {
    func gzipped() -> Data? {
        var stream = z_stream()
        let initStatus = deflateInit2_(&stream, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 15 + 16, 8, Z_DEFAULT_STRATEGY, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
        guard initStatus == Z_OK else { return nil }
        defer { deflateEnd(&stream) }

        var output = Data(capacity: count)

        withUnsafeBytes { (inputPointer: UnsafeRawBufferPointer) in
            stream.avail_in = uInt(count)
            stream.next_in = UnsafeMutablePointer<Bytef>(mutating: inputPointer.bindMemory(to: Bytef.self).baseAddress!)

            var deflateStatus: Int32 = Z_OK
            while deflateStatus != Z_STREAM_END {
                var buffer = [Bytef](repeating: 0, count: 32768)
                let flushMode: Int32 = stream.avail_in == 0 ? Z_FINISH : Z_NO_FLUSH

                buffer.withUnsafeMutableBufferPointer { ptr in
                    stream.next_out = ptr.baseAddress
                    stream.avail_out = uInt(ptr.count)
                    deflateStatus = deflate(&stream, flushMode)
                    output.append(ptr.baseAddress!, count: ptr.count - Int(stream.avail_out))
                }
            }
        }

        return output
    }
}
