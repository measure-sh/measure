//
//  GestureDetector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/09/24.
//

import UIKit

// swiftlint:disable identifier_name
enum DetectedGesture {
    case click(x: CGFloat,
               y: CGFloat,
               touchDownTime: UnsignedNumber,
               touchUpTime: UnsignedNumber,
               target: String?,
               targetId: String?,
               targetFrame: CGRect?)
    case longClick(x: CGFloat,
                   y: CGFloat,
                   touchDownTime: UnsignedNumber,
                   touchUpTime: UnsignedNumber,
                   target: String?,
                   targetId: String?,
                   targetFrame: CGRect?)
    case scroll(x: CGFloat,
                y: CGFloat,
                endX: CGFloat,
                endY: CGFloat,
                direction: Direction,
                touchDownTime: UnsignedNumber,
                touchUpTime: UnsignedNumber,
                target: String?,
                targetId: String?)
}

struct GestureDetector {
    private static var startTouchX: CGFloat = 0
    private static var startTouchY: CGFloat = 0
    private static var startTouchEventTime: UnsignedNumber = 0
    private static var touchSlop: CGFloat = 0
    private static var isScrolling: Bool = false
    private static var target: String?
    private static var targetId: String?
    private static var targetFrame: CGRect?

    static func detect(event: UIEvent, // swiftlint:disable:this cyclomatic_complexity function_body_length
                       in view: UIView,
                       timeProvider: TimeProvider,
                       scaledTouchSlop: CGFloat,
                       longPressTimeout: TimeInterval) -> DetectedGesture? {
        guard let touches = event.allTouches, let touch = touches.first else {
            return nil
        }

        if targetId == nil {
            targetId = touch.view?.accessibilityIdentifier
            targetFrame = touch.view?.frame
        }
        if target == nil, let classForCoder = touch.view?.classForCoder {
            target = NSStringFromClass(classForCoder)
        }

        if touchSlop == 0 {
            touchSlop = scaledTouchSlop
        }

        let location = touch.location(in: view)

        switch touch.phase {
        case .began:
            startTouchX = location.x
            startTouchY = location.y
            startTouchEventTime = UnsignedNumber(timeProvider.millisTime)
            isScrolling = false
        case .moved:
            // Movement detected, check if it is a scroll gesture
            let dx = abs(startTouchX - location.x)
            let dy = abs(startTouchY - location.y)

            if (dx > touchSlop || dy > touchSlop) && !isScrolling {
                // Once the movement exceeds the touchSlop, consider it a scroll
                isScrolling = true
            }
        case .ended:
            if !isScrolling {
                let currentTime = UInt64(timeProvider.millisTime)
                if currentTime > startTouchEventTime {
                    let dt = currentTime - startTouchEventTime
                    let dx = abs(startTouchX - location.x)
                    let dy = abs(startTouchY - location.y)
                    if dx <= touchSlop && dy <= touchSlop {
                        if TimeInterval(dt) >= longPressTimeout {
                            let longClick: DetectedGesture = .longClick(
                                x: location.x,
                                y: location.y,
                                touchDownTime: startTouchEventTime,
                                touchUpTime: UnsignedNumber(timeProvider.millisTime),
                                target: target,
                                targetId: targetId,
                                targetFrame: targetFrame)
                            target = nil
                            targetId = nil
                            return longClick
                        } else {
                            let click: DetectedGesture = .click(
                                x: location.x,
                                y: location.y,
                                touchDownTime: startTouchEventTime,
                                touchUpTime: UnsignedNumber(timeProvider.millisTime),
                                target: target,
                                targetId: targetId,
                                targetFrame: targetFrame)
                            target = nil
                            targetId = nil
                            return click
                        }
                    }
                }
            } else {
                let scroll: DetectedGesture = .scroll(
                    x: startTouchX,
                    y: startTouchY,
                    endX: location.x,
                    endY: location.y,
                    direction: calculateScrollDirection(endX: location.x, endY: location.y, startX: startTouchX, startY: startTouchY),
                    touchDownTime: startTouchEventTime,
                    touchUpTime: UnsignedNumber(timeProvider.millisTime),
                    target: target,
                    targetId: targetId)
                target = nil
                targetId = nil
                return scroll
            }
        default:
            return nil
        }

        return nil
    }

    private static func calculateScrollDirection(endX: CGFloat, endY: CGFloat, startX: CGFloat, startY: CGFloat) -> Direction {
        let diffX = endX - startX
        let diffY = endY - startY
        if abs(diffX) > abs(diffY) {
            return diffX > 0 ? .right : .left
        } else {
            return diffY > 0 ? .down : .up
        }
    }
}
// swiftlint:enable identifier_name
