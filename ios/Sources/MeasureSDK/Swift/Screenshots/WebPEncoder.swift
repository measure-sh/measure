//
//  WebPEncoder.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/04/26.
//

import UIKit
#if canImport(MeasureWebP)
import MeasureWebP
#endif

struct WebPEncoder {
    static func encode(_ image: UIImage, quality: CGFloat) -> Data? {
        guard let cgImage = image.cgImage else { return nil }

        let width = cgImage.width
        let height = cgImage.height
        let bytesPerRow = width * 4

        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(
                data: nil,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              ) else { return nil }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))

        guard let pixelData = context.data else { return nil }

        var output: UnsafeMutablePointer<UInt8>? = nil
        let size = WebPEncodeRGBA(
            pixelData.assumingMemoryBound(to: UInt8.self),
            Int32(width),
            Int32(height),
            Int32(bytesPerRow),
            Float(quality * 100.0),
            &output
        )

        guard size > 0, let outputPtr = output else { return nil }
        defer { WebPFree(outputPtr) }

        return Data(bytes: outputPtr, count: size)
    }
}
