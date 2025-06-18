//
//  BaseSvgGenerator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/02/25.
//

import UIKit

struct SvgFrame {
    let frame: CGRect
    let isTarget: Bool
}

protocol SvgGenerator {
    func generate(for frames: [SvgFrame]) -> Data?
}

final class BaseSvgGenerator: SvgGenerator {
    func generate(for frames: [SvgFrame]) -> Data? {
        guard let maxWidth = frames.map({ $0.frame.maxX }).max(),
              let maxHeight = frames.map({ $0.frame.maxY }).max() else {
            return nil
        }

        let windowWidth = Int(maxWidth)
        let windowHeight = Int(maxHeight)

        var svg = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \(windowWidth) \(windowHeight)">
            <defs>
                <pattern id="d" width="24" height="24" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <line y1="0" y2="24" stroke="#fef08a" stroke-width="3"/>
                </pattern>
                <linearGradient id="text-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#fef08a;stop-opacity:0.1"/>
                    <stop offset="100%" style="stop-color:#fef08a;stop-opacity:0.05"/>
                </linearGradient>
                <style>
                    .base-rect { fill: none; }
                    .grey-rect { stroke: #64748b; stroke-width: 2; }
                    .text-rect { fill: url(#text-gradient); }
                    .target-rect { fill: url(#d); stroke: #fef08a; stroke-width: 3; }
                </style>
            </defs>
            <g>
                <rect width="100%" height="100%" fill="#262626"/>
                <g class="base-rect grey-rect">
        """

        var uniqueSet = Set<String>()

        for svgFrame in frames {
            let rect = svgFrame.frame
            let frameKey = "\(rect.origin.x),\(rect.origin.y),\(rect.width),\(rect.height)"
            guard !uniqueSet.contains(frameKey) else { continue }
            uniqueSet.insert(frameKey)

            svg += svgRect(frame: rect, isTarget: svgFrame.isTarget)
        }

        svg += """
                </g>
            </g>
        </svg>
        """

        return svg.data(using: .utf8)
    }

    private func svgRect(frame: CGRect, isTarget: Bool) -> String {
        let originX = frame.origin.x.safeInt
        let originY = frame.origin.y.safeInt
        let width = frame.width.safeInt
        let height = frame.height.safeInt
        let targetClass = isTarget ? " class=\"target-rect\"" : ""

        return "<rect x=\"\(originX)\" y=\"\(originY)\" width=\"\(width)\" height=\"\(height)\"\(targetClass)/>"
    }
}
