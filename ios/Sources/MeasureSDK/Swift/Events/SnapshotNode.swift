//
//  SnapshotNode.swift
//  Measure
//
//  Created by Adwin Ross on 16/03/26.
//

import Foundation

enum ElementType: String, Codable {
    case container
    case text
    case input
    case button
    case image
    case video
    case list
    case icon
    case checkbox
    case radio
    case dropdown
    case slider
    case progress
}

struct SnapshotNode: Codable {
    let label: String
    let type: ElementType
    let x: Double
    let y: Double
    let width: Double
    let height: Double
    let highlighted: Bool
    let scrollable: Bool
    let children: [SnapshotNode]

    init(label: String,
         type: ElementType = .container,
         x: Double,
         y: Double,
         width: Double,
         height: Double,
         highlighted: Bool = false,
         scrollable: Bool = false,
         children: [SnapshotNode] = []) {
        self.label = label
        self.type = type
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.highlighted = highlighted
        self.scrollable = scrollable
        self.children = children
    }
}
