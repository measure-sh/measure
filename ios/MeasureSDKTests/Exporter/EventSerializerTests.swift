//
//  EventSerializerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/10/24.
//

import XCTest
@testable import MeasureSDK

final class EventSerializerTests: XCTestCase { // swiftlint:disable:this type_body_length
    let eventSerializer = EventSerializer()

    func testEventEntity_ScrollDataSerialization() {
        let scrollData = ScrollData(
            target: "scrollview",
            targetId: "scroll_1",
            x: 0.0,
            y: 0.0,
            endX: 50.5,
            endY: 100.0,
            direction: .down,
            touchDownTime: 100,
            touchUpTime: 200
        )

        let event = Event(
            id: "123",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:00:00Z",
            timestampInMillis: 123456789,
            type: .gestureScroll,
            data: scrollData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: true
        )

        let eventEntity = EventEntity(event)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent should not return nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            // Validate the ScrollData fields
            if let scrollDataDict = jsonDict?["gesture_scroll"] as? [String: Any] {
                XCTAssertEqual(scrollDataDict["target"] as? String, "scrollview")
                XCTAssertEqual(scrollDataDict["target_id"] as? String, "scroll_1")
                XCTAssertEqual(scrollDataDict["x"] as? FloatNumber, 0.0)
                XCTAssertEqual(scrollDataDict["y"] as? FloatNumber, 0.0)
                XCTAssertEqual(scrollDataDict["end_x"] as? FloatNumber, 50.5)
                XCTAssertEqual(scrollDataDict["end_y"] as? FloatNumber, 100.0)
                XCTAssertEqual(scrollDataDict["direction"] as? String, "down")
                XCTAssertEqual(scrollDataDict["touch_down_time"] as? Number, 100)
                XCTAssertEqual(scrollDataDict["touch_up_time"] as? Number, 200)
            } else {
                XCTFail("Gesture scroll data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testEventEntity_LongClickDataSerialization() {
        let longClickData = LongClickData(
            target: "button",
            targetId: "button_1",
            width: 10,
            height: 20,
            x: 100,
            y: 50,
            touchDownTime: 100,
            touchUpTime: 200
        )

        let event = Event(
            id: "456",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:01:00Z",
            timestampInMillis: 123456790,
            type: .gestureLongClick,
            data: longClickData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: true
        )

        let eventEntity = EventEntity(event)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let longClickDataDict = jsonDict?["gesture_long_click"] as? [String: Any] {
                XCTAssertEqual(longClickDataDict["target"] as? String, "button")
                XCTAssertEqual(longClickDataDict["target_id"] as? String, "button_1")
                XCTAssertEqual(longClickDataDict["x"] as? FloatNumber, 100)
                XCTAssertEqual(longClickDataDict["y"] as? FloatNumber, 50)
                XCTAssertEqual(longClickDataDict["width"] as? Number, 10)
                XCTAssertEqual(longClickDataDict["height"] as? Number, 20)
                XCTAssertEqual(longClickDataDict["touch_down_time"] as? Number, 100)
                XCTAssertEqual(longClickDataDict["touch_up_time"] as? Number, 200)
            } else {
                XCTFail("Gesture long click data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testEventEntity_ClickDataSerialization() {
        let clickData = ClickData(
            target: "button",
            targetId: "button_1",
            width: 100,
            height: 50,
            x: 15.0,
            y: 25.0,
            touchDownTime: 100,
            touchUpTime: 150
        )

        let event = Event(
            id: "789",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:02:00Z",
            timestampInMillis: 123456791,
            type: .gestureClick,
            data: clickData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: true
        )

        let eventEntity = EventEntity(event)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let clickDataDict = jsonDict?["gesture_click"] as? [String: Any] {
                XCTAssertEqual(clickDataDict["target"] as? String, "button")
                XCTAssertEqual(clickDataDict["target_id"] as? String, "button_1")
                XCTAssertEqual(clickDataDict["width"] as? Number, 100)
                XCTAssertEqual(clickDataDict["height"] as? Number, 50)
                XCTAssertEqual(clickDataDict["x"] as? FloatNumber, 15.0)
                XCTAssertEqual(clickDataDict["y"] as? FloatNumber, 25.0)
                XCTAssertEqual(clickDataDict["touch_down_time"] as? Number, 100)
                XCTAssertEqual(clickDataDict["touch_up_time"] as? Number, 150)
            } else {
                XCTFail("Gesture click data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testEventEntity_ExceptionSerialization() { // swiftlint:disable:this function_body_length
        let stackFrame = StackFrame(
            binaryName: "MyApp",
            binaryAddress: "0x0000000100000000",
            offset: "0x0000000000001234",
            frameIndex: 0,
            symbolAddress: "0x0000000100000000",
            inApp: true
        )

        let exceptionDetail = ExceptionDetail(
            type: "NullPointerException",
            message: "Attempted to dereference a null object",
            frames: [stackFrame],
            signal: nil,
            threadName: "main",
            threadSequence: 1,
            osBuildNumber: "20D74"
        )

        let exception = Exception(
            handled: false,
            exceptions: [exceptionDetail],
            foreground: true,
            threads: [ThreadDetail(name: "main", frames: [stackFrame], sequence: 1)]
        )

        let event = Event(
            id: "101112",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:03:00Z",
            timestampInMillis: 123456792,
            type: .exception,
            data: exception,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: true
        )

        let eventEntity = EventEntity(event)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let exceptionDict = jsonDict?["exception"] as? [String: Any] {
                XCTAssertEqual(exceptionDict["handled"] as? Bool, false)
                XCTAssertEqual(exceptionDict["foreground"] as? Bool, true)

                if let exceptionDetails = exceptionDict["exceptions"] as? [[String: Any]],
                   let firstException = exceptionDetails.first {
                    XCTAssertEqual(firstException["type"] as? String, "NullPointerException")
                    XCTAssertEqual(firstException["message"] as? String, "Attempted to dereference a null object")
                    XCTAssertEqual(firstException["thread_name"] as? String, "main")
                    XCTAssertEqual(firstException["thread_sequence"] as? Number, 1)
                    XCTAssertEqual(firstException["os_build_number"] as? String, "20D74")

                    if let frames = firstException["frames"] as? [[String: Any]],
                       let firstFrame = frames.first {
                        XCTAssertEqual(firstFrame["binary_name"] as? String, "MyApp")
                        XCTAssertEqual(firstFrame["binary_address"] as? String, "0x0000000100000000")
                        XCTAssertEqual(firstFrame["offset"] as? String, "0x0000000000001234")
                        XCTAssertEqual(firstFrame["frame_index"] as? Number, 0)
                        XCTAssertEqual(firstFrame["symbol_address"] as? String, "0x0000000100000000")
                        XCTAssertEqual(firstFrame["in_app"] as? Bool, true)
                    } else {
                        XCTFail("Stack frames are not present in the exception details.")
                    }
                } else {
                    XCTFail("Exception details are not present in the serialized event.")
                }

                if let threads = exceptionDict["threads"] as? [[String: Any]],
                   let firstThread = threads.first {
                    XCTAssertEqual(firstThread["name"] as? String, "main")
                    XCTAssertEqual(firstThread["sequence"] as? Number, 1)

                    if let threadFrames = firstThread["frames"] as? [[String: Any]],
                       let firstThreadFrame = threadFrames.first {
                        XCTAssertEqual(firstThreadFrame["binary_name"] as? String, "MyApp")
                    } else {
                        XCTFail("Thread frames are not present.")
                    }
                } else {
                    XCTFail("Threads are not present in the exception details.")
                }
            } else {
                XCTFail("Exception data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testEventEntity_EventObjectContents() {
        let clickData = ClickData(
            target: "button",
            targetId: "button_1",
            width: 100,
            height: 50,
            x: 15.0,
            y: 25.0,
            touchDownTime: 100,
            touchUpTime: 150
        )

        let attributes = TestDataGenerator.generateAttributes()
        let event = Event(
            id: "eventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:02:00Z",
            timestampInMillis: 123456791,
            type: .gestureClick,
            data: clickData,
            attachments: [],
            attributes: attributes,
            userTriggered: true
        )

        let eventEntity = EventEntity(event)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            if let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any] {
                XCTAssertEqual(jsonDict["id"] as? String, "eventId")
                XCTAssertEqual(jsonDict["session_id"] as? String, "sessionId")
                XCTAssertEqual(jsonDict["timestamp"] as? String, "2024-10-22T10:02:00Z")
                XCTAssertEqual(jsonDict["type"] as? String, "gesture_click")
                XCTAssertEqual(jsonDict["user_triggered"] as? Bool, true)
            } else {
                XCTFail("Invalid JSON object.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testEventEntity_AttributesContents() {
        let attributes = TestDataGenerator.generateAttributes()

        let event = Event(
            id: "123",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:02:00Z",
            timestampInMillis: 123456789,
            type: .gestureScroll,
            data: ScrollData(target: nil, targetId: nil, x: 0.0, y: 0.0, endX: 50.5, endY: 100.0, direction: .down, touchDownTime: 100, touchUpTime: 200),
            attachments: [],
            attributes: attributes,
            userTriggered: false
        )

        guard let jsonString = eventSerializer.getSerialisedEvent(for: EventEntity(event)) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            let attributesDict = jsonDict?["attribute"] as? [String: Any]

            XCTAssertEqual(attributesDict?["thread_name"] as? String, attributes.threadName)
            XCTAssertEqual(attributesDict?["device_name"] as? String, attributes.deviceName)
            XCTAssertEqual(attributesDict?["device_model"] as? String, attributes.deviceModel)
            XCTAssertEqual(attributesDict?["device_manufacturer"] as? String, attributes.deviceManufacturer)
            XCTAssertEqual(attributesDict?["device_type"] as? String, attributes.deviceType?.rawValue)
            XCTAssertEqual(attributesDict?["device_is_foldable"] as? Bool, attributes.deviceIsFoldable)
            XCTAssertEqual(attributesDict?["device_is_physical"] as? Bool, attributes.deviceIsPhysical)
            XCTAssertEqual(attributesDict?["device_density_dpi"] as? Number, attributes.deviceDensityDpi)
            XCTAssertEqual(attributesDict?["device_width_px"] as? Number, attributes.deviceWidthPx)
            XCTAssertEqual(attributesDict?["device_height_px"] as? Number, attributes.deviceHeightPx)
            XCTAssertEqual(attributesDict?["device_density"] as? Number, attributes.deviceDensity)
            XCTAssertEqual(attributesDict?["device_locale"] as? String, attributes.deviceLocale)
            XCTAssertEqual(attributesDict?["os_name"] as? String, attributes.osName)
            XCTAssertEqual(attributesDict?["os_version"] as? String, attributes.osVersion)
            XCTAssertEqual(attributesDict?["platform"] as? String, attributes.platform)
            XCTAssertEqual(attributesDict?["network_type"] as? String, attributes.networkType?.rawValue)
            XCTAssertEqual(attributesDict?["network_generation"] as? String, attributes.networkGeneration?.rawValue)
            XCTAssertEqual(attributesDict?["network_provider"] as? String, attributes.networkProvider)
            XCTAssertEqual(attributesDict?["installation_id"] as? String, attributes.installationId)
            XCTAssertEqual(attributesDict?["user_id"] as? String, attributes.userId)
            XCTAssertEqual(attributesDict?["device_cpu_arch"] as? String, attributes.deviceCpuArch)
            XCTAssertEqual(attributesDict?["app_version"] as? String, attributes.appVersion)
            XCTAssertEqual(attributesDict?["app_build"] as? String, attributes.appBuild)
            XCTAssertEqual(attributesDict?["measure_sdk_version"] as? String, attributes.measureSdkVersion)
            XCTAssertEqual(attributesDict?["app_unique_id"] as? String, attributes.appUniqueId)
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

}
