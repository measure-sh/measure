//
//  EventType.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 05/09/24.
//

import Foundation

enum EventType: String, Codable {
    case exception
    case gestureClick = "gesture_click"
    case gestureLongClick = "gesture_long_click"
    case gestureScroll = "gesture_scroll"
}
