//
//  GestureCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/09/24.
//

import UIKit

protocol GestureCollector {
    func enable(for window: UIWindow)
    func processEvent(_ event: UIEvent)
}

final class BaseGestureCollector: GestureCollector {
    private let logger: Logger
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private let configProvider: ConfigProvider
    private let gestureTargetFinder: GestureTargetFinder
    private var window: UIWindow?

    init(logger: Logger,
         eventProcessor: EventProcessor,
         timeProvider: TimeProvider,
         configProvider: ConfigProvider,
         gestureTargetFinder: GestureTargetFinder) {
        self.logger = logger
        self.eventProcessor = eventProcessor
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.gestureTargetFinder = gestureTargetFinder
    }

    func enable(for window: UIWindow) {
        self.window = window
        logger.internalLog(level: .debug, message: "GestureCollector enabled", error: nil, data: nil)
        self.window?.setGestureCollector(self)
        self.window?.swizzleSendEvent()
    }

    func processEvent(_ event: UIEvent) {
        if let window = window, let detectedGesture = GestureDetector.detect(event: event,
                                                        in: window,
                                                        timeProvider: timeProvider,
                                                        scaledTouchSlop: configProvider.scaledTouchSlop,
                                                        longPressTimeout: configProvider.longPressTimeout) {
            handleGesture(detectedGesture)
        }
    }

    private func handleGesture(_ gesture: DetectedGesture) {
        // swiftlint:disable identifier_name
        guard let window = window else {
            logger.log(level: .error, message: "No window detected. Could not enable GestureCollector.", error: nil, data: nil)
            return
        }
        switch gesture {
        case .click(let x, let y, let touchDownTime, let touchUpTime, let target, let targetId, let targetFrame):
            let gestureTargetFinderData = gestureTargetFinder.findClickable(x: x, y: y, window: window)
            let width = UInt16((gestureTargetFinderData.targetFrame?.width ?? targetFrame?.width) ?? 0)
            let height = UInt16((gestureTargetFinderData.targetFrame?.height ?? targetFrame?.height) ?? 0)

            let data = ClickData(target: gestureTargetFinderData.target ?? target,
                                 targetId: gestureTargetFinderData.targetId ?? targetId,
                                 width: width != 0 ? width : nil,
                                 height: height != 0 ? height : nil,
                                 x: FloatNumber32(x),
                                 y: FloatNumber32(y),
                                 touchDownTime: touchDownTime,
                                 touchUpTime: touchUpTime)
            eventProcessor.track(data: data, timestamp: timeProvider.now(), type: .gestureClick, attributes: nil, sessionId: nil, attachments: nil, userDefinedAttributes: nil)
        case .longClick(let x, let y, let touchDownTime, let touchUpTime, let target, let targetId, let targetFrame):
            let gestureTargetFinderData = gestureTargetFinder.findClickable(x: x, y: y, window: window)
            let width = UInt16((gestureTargetFinderData.targetFrame?.width ?? targetFrame?.width) ?? 0)
            let height = UInt16((gestureTargetFinderData.targetFrame?.height ?? targetFrame?.height) ?? 0)

            let data = LongClickData(target: gestureTargetFinderData.target ?? target,
                                     targetId: gestureTargetFinderData.targetId ?? targetId,
                                     width: width != 0 ? width : nil,
                                     height: height != 0 ? height : nil,
                                     x: FloatNumber32(x),
                                     y: FloatNumber32(y),
                                     touchDownTime: touchDownTime,
                                     touchUpTime: touchUpTime)
            eventProcessor.track(data: data, timestamp: timeProvider.now(), type: .gestureLongClick, attributes: nil, sessionId: nil, attachments: nil, userDefinedAttributes: nil)
        case .scroll(let startX, let startY, let endX, let endY, let direction, let touchDownTime, let touchUpTime, let target, let targetId):
            let startScrollPoint = CGPoint(x: startX, y: startY)
            let endScrollPoint = CGPoint(x: endX, y: endY)
            if let gestureTargetFinderData = gestureTargetFinder.findScrollable(startScrollPoint: startScrollPoint, endScrollPoint: endScrollPoint, window: window) {
                let data = ScrollData(target: gestureTargetFinderData.target ?? target,
                                      targetId: gestureTargetFinderData.targetId ?? targetId,
                                      x: FloatNumber32(startX),
                                      y: FloatNumber32(startY),
                                      endX: FloatNumber32(endX),
                                      endY: FloatNumber32(endY),
                                      direction: direction,
                                      touchDownTime: touchDownTime,
                                      touchUpTime: touchUpTime)
                eventProcessor.track(data: data, timestamp: timeProvider.now(), type: .gestureScroll, attributes: nil, sessionId: nil, attachments: nil, userDefinedAttributes: nil)
            }
        }
        // swiftlint:enable identifier_name
    }
}
