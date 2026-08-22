//
//  Fixtures.swift
//  PerfTests
//
//  Created by Adwin Ross on 22/08/26.
//

import Foundation
@testable import Measure

enum Fixtures {
    static func typicalBatch(eventCount: Int) -> [EventEntity] {
        (0..<eventCount).map { index in
            switch index % 20 {
            case 0:
                return exceptionEvent(index: index, frameCount: 40)
            case 1, 2:
                return customEvent(index: index)
            case 3, 4, 5:
                return lifecycleEvent(index: index)
            default:
                return clickEvent(index: index)
            }
        }
    }

    static func attachmentBatch(eventCount: Int, attachmentsPerEvent: Int, attachmentBytes: Int) -> [EventEntity] {
        let payload = Data(repeating: 0xA7, count: attachmentBytes)

        return (0..<eventCount).map { index in
            let attachments = (0..<attachmentsPerEvent).map { attachmentIndex in
                MsrAttachment(name: "screenshot_\(index)_\(attachmentIndex).webp",
                              type: .screenshot,
                              size: Int64(payload.count),
                              id: "attachment-\(index)-\(attachmentIndex)",
                              bytes: payload,
                              path: nil)
            }

            let event = Event(id: "event-attachment-\(index)",
                              sessionId: sessionId,
                              timestamp: timestamp,
                              timestampInMillis: 1727272496000,
                              type: .gestureClick,
                              data: clickData,
                              attachments: attachments,
                              attributes: attributes(),
                              userTriggered: true,
                              userDefinedAttributes: userDefinedAttributes)
            return EventEntity(event, needsReporting: true)
        }
    }

    static func spans(count: Int) -> [SpanEntity] {
        let encoder = JSONEncoder()
        let attributesBlob = try? encoder.encode(attributes())
        let checkpointsBlob = try? encoder.encode([
            Checkpoint(name: "viewDidLoad", timestamp: timestamp),
            Checkpoint(name: "viewDidAppear", timestamp: timestamp)
        ])
        let userDefinedBlob = try? JSONSerialization.data(withJSONObject: ["screen": "checkout", "attempt": 2],
                                                          options: [.sortedKeys])

        return (0..<count).map { index in
            SpanEntity(name: "ViewController.viewDidLoad",
                       traceId: "trace-\(index)",
                       spanId: "span-\(index)",
                       parentId: index % 3 == 0 ? nil : "span-\(index - 1)",
                       sessionId: sessionId,
                       startTime: 1727272496000,
                       startTimeString: timestamp,
                       endTime: 1727272496200,
                       endTimeString: timestamp,
                       duration: 200,
                       status: Int64(index % 3),
                       attributes: attributesBlob,
                       userDefinedAttrs: userDefinedBlob,
                       checkpoints: checkpointsBlob,
                       hasEnded: true,
                       isSampled: true,
                       batchId: nil)
        }
    }

    private static func clickEvent(index: Int) -> EventEntity {
        let event = Event(id: "event-click-\(index)",
                          sessionId: sessionId,
                          timestamp: timestamp,
                          timestampInMillis: 1727272496000,
                          type: .gestureClick,
                          data: clickData,
                          attachments: nil,
                          attributes: attributes(),
                          userTriggered: false,
                          userDefinedAttributes: nil)
        return EventEntity(event, needsReporting: true)
    }

    private static func lifecycleEvent(index: Int) -> EventEntity {
        let event = Event(id: "event-lifecycle-\(index)",
                          sessionId: sessionId,
                          timestamp: timestamp,
                          timestampInMillis: 1727272496000,
                          type: .lifecycleApp,
                          data: ApplicationLifecycleData(type: index % 2 == 0 ? .foreground : .background),
                          attachments: nil,
                          attributes: attributes(),
                          userTriggered: false,
                          userDefinedAttributes: nil)
        return EventEntity(event, needsReporting: true)
    }

    private static func customEvent(index: Int) -> EventEntity {
        let event = Event(id: "event-custom-\(index)",
                          sessionId: sessionId,
                          timestamp: timestamp,
                          timestampInMillis: 1727272496000,
                          type: .custom,
                          data: CustomEventData(name: "checkout_step_\(index % 5)"),
                          attachments: nil,
                          attributes: attributes(),
                          userTriggered: true,
                          userDefinedAttributes: userDefinedAttributes)
        return EventEntity(event, needsReporting: true)
    }

    private static func exceptionEvent(index: Int, frameCount: Int) -> EventEntity {
        let frames: [StackFrame] = (0..<frameCount).map { (frameIndex: Int) -> StackFrame in
            let offset: Int = 1234 + frameIndex
            let position: Number = Number(frameIndex)
            let lineNumber: Number = 100 + position
            let columnNumber: Number = 24

            return StackFrame(binaryName: "DemoApp",
                              binaryAddress: "0x0000000100000000",
                              offset: offset,
                              frameIndex: position,
                              symbolAddress: "0x0000000100000000",
                              inApp: frameIndex % 3 == 0,
                              className: "MeasureSDK.SignalProcessor",
                              methodName: "track(data:timestamp:type:attributes:sessionId:)",
                              fileName: "SignalProcessor.swift",
                              lineNumber: lineNumber,
                              columnNumber: columnNumber,
                              moduleName: "MeasureSDK",
                              instructionAddress: "0x0000000000000000")
        }

        let binaryImage = BinaryImage(startAddress: "1081da000",
                                      endAddress: "1081fffff",
                                      baseAddress: nil,
                                      system: false,
                                      name: "DemoApp",
                                      arch: "arm64e",
                                      uuid: "a02da00e792a395aa1d40cc1f071946f",
                                      path: "/var/containers/Bundle/Application/DemoApp.app/DemoApp")

        let detail = ExceptionDetail(type: "NSInvalidArgumentException",
                                    message: "unrecognized selector sent to instance 0x600002a1c4e0",
                                    frames: frames,
                                    signal: nil,
                                    threadName: "main",
                                    threadSequence: 1,
                                    osBuildNumber: "20D74")

        let exception = Exception(exceptions: [detail],
                                  foreground: true,
                                  threads: [ThreadDetail(name: "main", frames: frames, sequence: 1)],
                                  binaryImages: [binaryImage],
                                  framework: "ios",
                                  severity: nil,
                                  isCustom: nil,
                                  numCode: nil,
                                  code: nil,
                                  meta: nil)

        let event = Event(id: "event-exception-\(index)",
                          sessionId: sessionId,
                          timestamp: timestamp,
                          timestampInMillis: 1727272496000,
                          type: .exception,
                          data: exception,
                          attachments: nil,
                          attributes: attributes(),
                          userTriggered: false,
                          userDefinedAttributes: nil)
        return EventEntity(event, needsReporting: true)
    }

    private static let sessionId = "9F0E9C3A-1F2B-4C3D-9E8F-0A1B2C3D4E5F"
    private static let timestamp = "2026-08-20T10:00:00.000Z"

    private static let userDefinedAttributes = EventSerializer.serializeUserDefinedAttribute([
        "plan": .string("pro"),
        "retries": .int(3),
        "beta": .boolean(true)
    ])

    private static let clickData = ClickData(target: "UIButton",
                                            targetId: "checkout_button",
                                            label: "Add to cart",
                                            semanticLabel: "Add item to cart",
                                            width: 100,
                                            height: 50,
                                            x: 15.0,
                                            y: 25.0,
                                            touchDownTime: 100,
                                            touchUpTime: 150)

    private static func attributes() -> Attributes {
        Attributes(threadName: "com.measure.export",
                   deviceName: "iPhone17,1",
                   deviceModel: "iPhone 17 Pro",
                   deviceManufacturer: "Apple",
                   deviceType: .phone,
                   deviceIsFoldable: false,
                   deviceIsPhysical: true,
                   deviceDensityDpi: 460,
                   deviceWidthPx: 1206,
                   deviceHeightPx: 2622,
                   deviceDensity: 3,
                   deviceLocale: "en_GB",
                   osName: "ios",
                   osVersion: "26.6",
                   networkType: .wifi,
                   networkGeneration: .generation5,
                   networkProvider: "airtel",
                   installationId: "installation-id",
                   userId: "user-123",
                   deviceCpuArch: "arm64e",
                   appVersion: "1.4.2",
                   appBuild: "482",
                   measureSdkVersion: "0.9.1",
                   appUniqueId: "sh.measure.demo")
    }
}
