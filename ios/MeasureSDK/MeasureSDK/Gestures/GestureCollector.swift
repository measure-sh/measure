//
//  GestureCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/09/24.
//

import UIKit

protocol GestureCollector {
    func enable()
    func processEvent(_ event: UIEvent)
}

final class BaseGestureCollector: GestureCollector {
    private let logger: Logger
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private let configProvider: ConfigProvider
    private let gestureTargetFinder: GestureTargetFinder

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

    func enable() {
        logger.internalLog(level: .debug, message: "GestureCollector enabled", error: nil)
        UIWindow.setGestureCollector(self)
        UIWindow.swizzleSendEvent()
    }

    func processEvent(_ event: UIEvent) {
        guard let window = UIApplication.shared.windows.first else { return }

        if let detectedGesture = GestureDetector.detect(event: event,
                                                        in: window,
                                                        timeProvider: timeProvider,
                                                        scaledTouchSlop: configProvider.scaledTouchSlop,
                                                        longPressTimeout: configProvider.longPressTimeout) {
            handleGesture(detectedGesture, window: window)
        }
    }

    private func handleGesture(_ gesture: DetectedGesture, window: UIWindow) {
        // swiftlint:disable identifier_name
        switch gesture {
        case .click(let x, let y, let touchDownTime, let touchUpTime, let target, let targetId, let targetFrame):
            let gestureTargetFinderData = gestureTargetFinder.findClickable(x: x, y: y, window: window)
            let width = Number((gestureTargetFinderData.targetFrame?.width ?? targetFrame?.width) ?? 0)
            let height = Number((gestureTargetFinderData.targetFrame?.height ?? targetFrame?.height) ?? 0)

            let data = ClickData(target: gestureTargetFinderData.target ?? target,
                                 targetId: gestureTargetFinderData.targetId ?? targetId,
                                 width: width != 0 ? width : nil,
                                 height: height != 0 ? height : nil,
                                 x: FloatNumber(x),
                                 y: FloatNumber(y),
                                 touchDownTime: touchDownTime,
                                 touchUpTime: touchUpTime)
            eventProcessor.track(data: data, timestamp: timeProvider.currentTimeSinceEpochInMillis, type: .gestureClick)
        case .longClick(let x, let y, let touchDownTime, let touchUpTime, let target, let targetId, let targetFrame):
            let gestureTargetFinderData = gestureTargetFinder.findClickable(x: x, y: y, window: window)
            let width = Number((gestureTargetFinderData.targetFrame?.width ?? targetFrame?.width) ?? 0)
            let height = Number((gestureTargetFinderData.targetFrame?.height ?? targetFrame?.height) ?? 0)

            let data = LongClickData(target: gestureTargetFinderData.target ?? target,
                                     targetId: gestureTargetFinderData.targetId ?? targetId,
                                     width: width != 0 ? width : nil,
                                     height: height != 0 ? height : nil,
                                     x: FloatNumber(x),
                                     y: FloatNumber(y),
                                     touchDownTime: touchDownTime,
                                     touchUpTime: touchUpTime)
            eventProcessor.track(data: data, timestamp: timeProvider.currentTimeSinceEpochInMillis, type: .gestureLongClick)
        case .scroll(let startX, let startY, let endX, let endY, let direction, let touchDownTime, let touchUpTime, let target, let targetId):
            let startScrollPoint = CGPoint(x: startX, y: startY)
            let endScrollPoint = CGPoint(x: endX, y: endY)
            if let gestureTargetFinderData = gestureTargetFinder.findScrollable(startScrollPoint: startScrollPoint, endScrollPoint: endScrollPoint, window: window) {
                let data = ScrollData(target: gestureTargetFinderData.target ?? target,
                                      targetId: gestureTargetFinderData.targetId ?? targetId,
                                      x: FloatNumber(startX),
                                      y: FloatNumber(startY),
                                      endX: FloatNumber(endX),
                                      endY: FloatNumber(endY),
                                      direction: direction,
                                      touchDownTime: touchDownTime,
                                      touchUpTime: touchUpTime)
                eventProcessor.track(data: data, timestamp: timeProvider.currentTimeSinceEpochInMillis, type: .gestureScroll)
            }
        }
        // swiftlint:enable identifier_name
    }
}
