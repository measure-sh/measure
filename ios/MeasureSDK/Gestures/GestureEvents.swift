//
//  GestureEvents.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/09/24.
//

import Foundation

// swiftlint:disable identifier_name

enum Direction: String, Codable {
    case down, up, right, left
}

struct ClickData: Codable {
    let target: String?
    let targetId: String?
    let width: Number?
    let height: Number?
    let x: FloatNumber32
    let y: FloatNumber32
    let touchDownTime: Number
    let touchUpTime: Number

    enum CodingKeys: String, CodingKey {
        case target
        case targetId = "target_id"
        case width
        case height
        case x
        case y
        case touchDownTime = "touch_down_time"
        case touchUpTime = "touch_up_time"
    }
}

struct LongClickData: Codable {
    let target: String?
    let targetId: String?
    let width: Number?
    let height: Number?
    let x: FloatNumber32
    let y: FloatNumber32
    let touchDownTime: Number
    let touchUpTime: Number

    enum CodingKeys: String, CodingKey {
        case target
        case targetId = "target_id"
        case width
        case height
        case x
        case y
        case touchDownTime = "touch_down_time"
        case touchUpTime = "touch_up_time"
    }
}

struct ScrollData: Codable {
    let target: String?
    let targetId: String?
    let x: FloatNumber32
    let y: FloatNumber32
    let endX: FloatNumber32
    let endY: FloatNumber32
    let direction: Direction
    let touchDownTime: Number
    let touchUpTime: Number

    enum CodingKeys: String, CodingKey {
        case target
        case targetId = "target_id"
        case x
        case y
        case endX = "end_x"
        case endY = "end_y"
        case direction
        case touchDownTime = "touch_down_time"
        case touchUpTime = "touch_up_time"
    }
}
// swiftlint:enable identifier_name
