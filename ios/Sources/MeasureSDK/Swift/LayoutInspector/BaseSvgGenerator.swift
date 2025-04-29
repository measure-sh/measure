//
//  BaseSvgGenerator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/02/25.
//

import UIKit

protocol SvgGenerator {
    func generate(for window: UIWindow, frames: [CGRect], targetView: UIView?) -> Data?
}

final class BaseSvgGenerator: SvgGenerator {
    func generate(for window: UIWindow, frames: [CGRect], targetView: UIView?) -> Data? {
        let windowWidth = Int(window.bounds.width)
        let windowHeight = Int(window.bounds.height)

        var svg = """
        <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 \(windowWidth) \(windowHeight)\">
            <defs>
                <pattern id=\"d\" width=\"24\" height=\"24\" patternTransform=\"rotate(45)\" patternUnits=\"userSpaceOnUse\">
                    <line y1=\"0\" y2=\"24\" stroke=\"#fef08a\" stroke-width=\"3\"/>
                </pattern>
                <linearGradient id=\"text-gradient\" x1=\"0%\" y1=\"0%\" x2=\"0%\" y2=\"100%\">
                    <stop offset=\"0%\" style=\"stop-color:#fef08a;stop-opacity:0.1\"/>
                    <stop offset=\"100%\" style=\"stop-color:#fef08a;stop-opacity:0.05\"/>
                </linearGradient>
                <style>
                    .base-rect { fill: none; }
                    .grey-rect { stroke: #64748b; stroke-width: 2; }
                    .text-rect { fill: url(#text-gradient); }
                    .target-rect { fill: url(#d); stroke: #fef08a; stroke-width: 3; }
                </style>
            </defs>
            <g>
                <rect width=\"100%\" height=\"100%\" fill=\"#262626\"/>
        """

        var uniqueSet = Set<String>()

        svg += "<g class=\"base-rect grey-rect\">"
        for frame in frames {
            let frameKey = "\(frame.origin.x),\(frame.origin.y),\(frame.width),\(frame.height)"
            guard !uniqueSet.contains(frameKey) else { continue }
            uniqueSet.insert(frameKey)

            let isTarget = targetView != nil && frame == targetView!.convert(targetView!.bounds, to: window)

            svg += svgRect(frame: frame, isTarget: isTarget)
        }
        svg += "</g>"

        svg += "</g></svg>"
        return svg.data(using: .utf8)
    }

    private func svgRect(frame: CGRect, isTarget: Bool) -> String {
        let x = frame.origin.x.safeInt // swiftlint:disable:this identifier_name
        let y = frame.origin.x.safeInt // swiftlint:disable:this identifier_name
        let width = frame.width.safeInt
        let height = frame.height.safeInt
        let targetClass = isTarget ? " class=\"target-rect\"" : ""

        return "<rect x=\"\(x)\" y=\"\(y)\" width=\"\(width)\" height=\"\(height)\"\(targetClass)/>"
    }
}
