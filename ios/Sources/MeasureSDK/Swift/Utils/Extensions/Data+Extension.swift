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
        guard !isEmpty else { return Data() }

        var stream = z_stream()
        let initStatus = deflateInit2_(
            &stream,
            Z_DEFAULT_COMPRESSION,
            Z_DEFLATED,
            MAX_WBITS + 16,
            MAX_MEM_LEVEL,
            Z_DEFAULT_STRATEGY,
            ZLIB_VERSION,
            Int32(MemoryLayout<z_stream>.size)
        )
        guard initStatus == Z_OK else { return nil }
        defer { deflateEnd(&stream) }

        let chunkSize = 1 << 14  // 16KB, same as GzipSwift
        var output = Data(capacity: chunkSize)
        var status: Int32 = Z_OK

        repeat {
            if Int(stream.total_out) >= output.count {
                output.count += chunkSize
            }

            let inputCount = count
            let outputCount = output.count

            withUnsafeBytes { (inputPointer: UnsafeRawBufferPointer) in
                stream.next_in = UnsafeMutablePointer<Bytef>(
                    mutating: inputPointer.bindMemory(to: Bytef.self).baseAddress!
                ).advanced(by: Int(stream.total_in))
                stream.avail_in = uInt(inputCount) - uInt(stream.total_in)

                output.withUnsafeMutableBytes { (outputPointer: UnsafeMutableRawBufferPointer) in
                    stream.next_out = outputPointer.bindMemory(to: Bytef.self).baseAddress!
                        .advanced(by: Int(stream.total_out))
                    stream.avail_out = uInt(outputCount) - uInt(stream.total_out)

                    status = deflate(&stream, Z_FINISH)

                    stream.next_out = nil
                }
                stream.next_in = nil
            }
        } while stream.avail_out == 0 && status != Z_STREAM_END

        guard status == Z_STREAM_END else { return nil }

        output.count = Int(stream.total_out)
        return output
    }
}
