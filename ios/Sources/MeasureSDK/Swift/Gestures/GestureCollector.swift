//
//  GestureCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/09/24.
//

import UIKit

protocol GestureCollector {
    func enable(for window: UIWindow)
    func disable()
    func processEvent(_ event: UIEvent)
}

final class BaseGestureCollector: GestureCollector {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let configProvider: ConfigProvider
    private let gestureTargetFinder: GestureTargetFinder
    private var window: UIWindow?
    private let layoutSnapshotGenerator: LayoutSnapshotGenerator
    private let systemFileManager: SystemFileManager
    private var isEnabled = false

    init(logger: Logger,
         signalProcessor: SignalProcessor,
         timeProvider: TimeProvider,
         configProvider: ConfigProvider,
         gestureTargetFinder: GestureTargetFinder,
         layoutSnapshotGenerator: LayoutSnapshotGenerator,
         systemFileManager: SystemFileManager) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.gestureTargetFinder = gestureTargetFinder
        self.layoutSnapshotGenerator = layoutSnapshotGenerator
        self.systemFileManager = systemFileManager
    }

    func enable(for window: UIWindow) {
        self.window = window
        logger.internalLog(level: .debug, message: "GestureCollector enabled.", error: nil, data: nil)
        UIApplication.shared.setGestureCollector(self)
        UIApplication.swizzleSendEvent()
        isEnabled = true
    }

    func disable() {
        isEnabled = false
        logger.internalLog(level: .debug, message: "GestureCollector disabled.", error: nil, data: nil)
    }

    func processEvent(_ event: UIEvent) {
        if isEnabled,
           let window = window,
           let detectedGesture = GestureDetector.detect(event: event,
                                                        in: window,
                                                        timeProvider: timeProvider,
                                                        scaledTouchSlop: configProvider.scaledTouchSlop,
                                                        longPressTimeout: configProvider.longPressTimeout) {
            handleGesture(detectedGesture)
        }
    }

    private func handleGesture(_ gesture: DetectedGesture) { // swiftlint:disable:this function_body_length
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

            collectLayoutSnapshot(gesture, touchPoint: CGPoint(x: x, y: y)) { attachment in
                self.signalProcessor.track(data: data,
                                      timestamp: self.timeProvider.now(),
                                      type: .gestureClick,
                                      attributes: nil,
                                      sessionId: nil,
                                      attachments: attachment == nil ? nil : [attachment!],
                                      userDefinedAttributes: nil,
                                      threadName: nil)
            }
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

            collectLayoutSnapshot(gesture, touchPoint: CGPoint(x: x, y: y)) { attachment in
                self.signalProcessor.track(data: data,
                                           timestamp: self.timeProvider.now(),
                                      type: .gestureLongClick,
                                      attributes: nil,
                                      sessionId: nil,
                                      attachments: attachment == nil ? nil : [attachment!],
                                      userDefinedAttributes: nil,
                                      threadName: nil)
            }
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

                collectLayoutSnapshot(gesture, touchPoint: CGPoint(x: startX, y: startY)) { attachment in
                    self.signalProcessor.track(data: data,
                                               timestamp: self.timeProvider.now(),
                                          type: .gestureScroll,
                                          attributes: nil,
                                          sessionId: nil,
                                          attachments: attachment == nil ? nil : [attachment!],
                                          userDefinedAttributes: nil,
                                          threadName: nil)
                }
            }
        }
        // swiftlint:enable identifier_name
    }

    private func collectLayoutSnapshot(_ gesture: DetectedGesture, touchPoint: CGPoint, completion: @escaping (MsrAttachment?) -> Void) {
        if let window = self.window {
            layoutSnapshotGenerator.generate(window: window, touchPoint: touchPoint) { attachment in
                completion(attachment)
            }
        } else {
            completion(nil)
            return
        }
    }
}
