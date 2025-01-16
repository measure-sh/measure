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

        let eventEntity = EventEntity(event, needsReporting: true)

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
                XCTAssertEqual(scrollDataDict["x"] as? FloatNumber32, 0.0)
                XCTAssertEqual(scrollDataDict["y"] as? FloatNumber32, 0.0)
                XCTAssertEqual(scrollDataDict["end_x"] as? FloatNumber32, 50.5)
                XCTAssertEqual(scrollDataDict["end_y"] as? FloatNumber32, 100.0)
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

        let eventEntity = EventEntity(event, needsReporting: true)

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
                XCTAssertEqual(longClickDataDict["x"] as? FloatNumber32, 100)
                XCTAssertEqual(longClickDataDict["y"] as? FloatNumber32, 50)
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

        let eventEntity = EventEntity(event, needsReporting: true)

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
                XCTAssertEqual(clickDataDict["x"] as? FloatNumber32, 15.0)
                XCTAssertEqual(clickDataDict["y"] as? FloatNumber32, 25.0)
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

        let eventEntity = EventEntity(event, needsReporting: true)

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

        let eventEntity = EventEntity(event, needsReporting: true)

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

        guard let jsonString = eventSerializer.getSerialisedEvent(for: EventEntity(event, needsReporting: true)) else {
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

    func testApplicationLifecycleDataSerialization() {
        let applicationLifecycleData = ApplicationLifecycleData(type: .foreground)

        let event = Event(
            id: "appLifecycleEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:05:00Z",
            timestampInMillis: 123456794,
            type: .lifecycleApp,
            data: applicationLifecycleData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let appLifecycleDataDict = jsonDict?["lifecycle_app"] as? [String: Any] {
                XCTAssertEqual(appLifecycleDataDict["type"] as? String, "foreground")
            } else {
                XCTFail("Application lifecycle data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testVCLifecycleDataSerialization() {
        let vcLifecycleData = VCLifecycleData(type: "viewWillAppear", className: "ViewController")

        let event = Event(
            id: "vcLifecycleEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:06:00Z",
            timestampInMillis: 123456795,
            type: .lifecycleViewController,
            data: vcLifecycleData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let vcLifecycleDataDict = jsonDict?["lifecycle_view_controller"] as? [String: Any] {
                XCTAssertEqual(vcLifecycleDataDict["type"] as? String, "viewWillAppear")
                XCTAssertEqual(vcLifecycleDataDict["class_name"] as? String, "ViewController")
            } else {
                XCTFail("ViewController lifecycle data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testSwiftUILifecycleDataSerialization() {
        let swiftUILifecycleData = SwiftUILifecycleData(type: .onAppear, className: "ContentView")

        let event = Event(
            id: "swiftUILifecycleEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:07:00Z",
            timestampInMillis: 123456796,
            type: .lifecycleSwiftUI,
            data: swiftUILifecycleData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let swiftUILifecycleDataDict = jsonDict?["lifecycle_swift_ui"] as? [String: Any] {
                XCTAssertEqual(swiftUILifecycleDataDict["type"] as? String, "on_appear")
                XCTAssertEqual(swiftUILifecycleDataDict["class_name"] as? String, "ContentView")
            } else {
                XCTFail("SwiftUI lifecycle data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testCpuUsageDataSerialization() {
        let cpuUsageData = CpuUsageData(
            numCores: 4,
            clockSpeed: 25,
            startTime: 1234,
            uptime: 5678,
            utime: 30,
            cutime: 15,
            cstime: 10,
            stime: 5,
            interval: 100,
            percentageUsage: 45.5
        )

        let event = Event(
            id: "cpuUsageEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:08:00Z",
            timestampInMillis: 123456797,
            type: .cpuUsage,
            data: cpuUsageData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let cpuUsageDataDict = jsonDict?["cpu_usage"] as? [String: Any] {
                XCTAssertEqual(cpuUsageDataDict["num_cores"] as? UInt8, 4)
                XCTAssertEqual(cpuUsageDataDict["clock_speed"] as? UInt32, 25)
                XCTAssertEqual(cpuUsageDataDict["start_time"] as? Int, 1234)
                XCTAssertEqual(cpuUsageDataDict["uptime"] as? Int, 5678)
                XCTAssertEqual(cpuUsageDataDict["utime"] as? Int, 30)
                XCTAssertEqual(cpuUsageDataDict["cutime"] as? Int, 15)
                XCTAssertEqual(cpuUsageDataDict["cstime"] as? Int, 10)
                XCTAssertEqual(cpuUsageDataDict["stime"] as? Int, 5)
                XCTAssertEqual(cpuUsageDataDict["interval"] as? UnsignedNumber, 100)
                XCTAssertEqual(cpuUsageDataDict["percentage_usage"] as? FloatNumber64, 45.5)
            } else {
                XCTFail("CPU usage data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testEventEntity_MemoryUsageDataSerialization() {
        let memoryUsageData = MemoryUsageData(
            maxMemory: 4096,
            usedMemory: 2048,
            interval: 100
        )

        let event = Event(
            id: "memoryUsageEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:09:00Z",
            timestampInMillis: 123456798,
            type: .memoryUsageAbsolute,
            data: memoryUsageData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let memoryUsageDataDict = jsonDict?["memory_usage_absolute"] as? [String: Any] {
                XCTAssertEqual(memoryUsageDataDict["interval"] as? UnsignedNumber, 100)
                XCTAssertEqual(memoryUsageDataDict["used_memory"] as? UnsignedNumber, 2048)
                XCTAssertEqual(memoryUsageDataDict["max_memory"] as? UnsignedNumber, 4096)
            } else {
                XCTFail("Memory usage data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testHotLaunchDataSerialization() {
        let hotLaunchData = HotLaunchData(
            appVisibleUptime: 50,
            onNextDrawUptime: 150,
            launchedActivity: "DetailActivity",
            hasSavedState: true,
            intentData: "testIntentData"
        )

        let event = Event(
            id: "hotLaunchEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:02:00Z",
            timestampInMillis: 123456791,
            type: .hotLaunch,
            data: hotLaunchData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let hotLaunchDataDict = jsonDict?["hot_launch"] as? [String: Any] {
                XCTAssertEqual(hotLaunchDataDict["app_visible_uptime"] as? UnsignedNumber, 50)
                XCTAssertEqual(hotLaunchDataDict["on_next_draw_uptime"] as? UnsignedNumber, 150)
                XCTAssertEqual(hotLaunchDataDict["launched_activity"] as? String, "DetailActivity")
                XCTAssertEqual(hotLaunchDataDict["has_saved_state"] as? Bool, true)
                XCTAssertEqual(hotLaunchDataDict["intent_data"] as? String, "testIntentData")
            } else {
                XCTFail("Hot launch data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testWarmLaunchDataSerialization() {
        let warmLaunchData = WarmLaunchData(
            appVisibleUptime: 100,
            onNextDrawUptime: 200,
            launchedActivity: "MainActivity",
            hasSavedState: false,
            intentData: "testIntentData"
        )

        let event = Event(
            id: "warmLaunchEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:03:00Z",
            timestampInMillis: 123456792,
            type: .warmLaunch,
            data: warmLaunchData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let warmLaunchDataDict = jsonDict?["warm_launch"] as? [String: Any] {
                XCTAssertEqual(warmLaunchDataDict["app_visible_uptime"] as? UnsignedNumber, 100)
                XCTAssertEqual(warmLaunchDataDict["on_next_draw_uptime"] as? UnsignedNumber, 200)
                XCTAssertEqual(warmLaunchDataDict["launched_activity"] as? String, "MainActivity")
                XCTAssertEqual(warmLaunchDataDict["has_saved_state"] as? Bool, false)
                XCTAssertEqual(warmLaunchDataDict["intent_data"] as? String, "testIntentData")
            } else {
                XCTFail("Warm launch data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testColdLaunchDataSerialization() {
        let coldLaunchData = ColdLaunchData(
            processStartUptime: 100,
            processStartRequestedUptime: 150,
            contentProviderAttachUptime: 200,
            onNextDrawUptime: 300,
            launchedActivity: "MainActivity",
            hasSavedState: true,
            intentData: "testIntentData"
        )

        let event = Event(
            id: "coldLaunchEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:04:00Z",
            timestampInMillis: 123456793,
            type: .coldLaunch,
            data: coldLaunchData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let coldLaunchDataDict = jsonDict?["cold_launch"] as? [String: Any] {
                XCTAssertEqual(coldLaunchDataDict["process_start_uptime"] as? UnsignedNumber, 100)
                XCTAssertEqual(coldLaunchDataDict["process_start_requested_uptime"] as? UnsignedNumber, 150)
                XCTAssertEqual(coldLaunchDataDict["content_provider_attach_uptime"] as? UnsignedNumber, 200)
                XCTAssertEqual(coldLaunchDataDict["on_next_draw_uptime"] as? UnsignedNumber, 300)
                XCTAssertEqual(coldLaunchDataDict["launched_activity"] as? String, "MainActivity")
                XCTAssertEqual(coldLaunchDataDict["has_saved_state"] as? Bool, true)
                XCTAssertEqual(coldLaunchDataDict["intent_data"] as? String, "testIntentData")
            } else {
                XCTFail("Cold launch data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testHttpDataSerialization() { // swiftlint:disable:this function_body_length
        let httpData = HttpData(
            url: "https://example.com/api/v1/resource",
            method: "GET",
            statusCode: 200,
            startTime: 123456789,
            endTime: 123456999,
            failureReason: nil,
            failureDescription: nil,
            requestHeaders: ["Content-Type": "application/json", "Authorization": "Bearer token"],
            responseHeaders: ["Server": "nginx", "Content-Length": "123"],
            requestBody: "requestBody",
            responseBody: "responseBody",
            client: "TestClient"
        )

        let event = Event(
            id: "httpEventId",
            sessionId: "sessionId",
            timestamp: "2024-12-14T10:00:00Z",
            timestampInMillis: 123456789000,
            type: .http,
            data: httpData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false)

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let httpDataDict = jsonDict?["http"] as? [String: Any] {
                XCTAssertEqual(httpDataDict["url"] as? String, "https://example.com/api/v1/resource")
                XCTAssertEqual(httpDataDict["method"] as? String, "GET")
                XCTAssertEqual(httpDataDict["status_code"] as? String, "200")
                XCTAssertEqual(httpDataDict["start_time"] as? String, "123456789")
                XCTAssertEqual(httpDataDict["end_time"] as? String, "123456999")
                XCTAssertNil(httpDataDict["failure_reason"])
                XCTAssertNil(httpDataDict["failure_description"])

                if let requestHeaders = httpDataDict["request_headers"] as? [String: String] {
                    XCTAssertEqual(requestHeaders["Content-Type"], "application/json")
                    XCTAssertEqual(requestHeaders["Authorization"], "Bearer token")
                } else {
                    XCTFail("Request headers are not serialized correctly.")
                }

                if let responseHeaders = httpDataDict["response_headers"] as? [String: String] {
                    XCTAssertEqual(responseHeaders["Server"], "nginx")
                    XCTAssertEqual(responseHeaders["Content-Length"], "123")
                } else {
                    XCTFail("Response headers are not serialized correctly.")
                }

                XCTAssertEqual(httpDataDict["request_body"] as? String, "requestBody")
                XCTAssertEqual(httpDataDict["response_body"] as? String, "responseBody")
                XCTAssertEqual(httpDataDict["client"] as? String, "TestClient")
            } else {
                XCTFail("HTTP data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }
    }

    func testCustomEventDataSerialization() { // swiftlint:disable:this function_body_length
        let customEventData = CustomEventData(name: "TestEvent")

        let event = Event(
            id: "customEventId",
            sessionId: "sessionId",
            timestamp: "2024-10-22T10:02:00Z",
            timestampInMillis: 123456791,
            type: .custom,
            data: customEventData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: true)

        let eventEntity = EventEntity(event, needsReporting: true)

        guard let jsonString = eventSerializer.getSerialisedEvent(for: eventEntity) else {
            XCTFail("getSerialisedEvent cannot be nil")
            return
        }

        let jsonData = Data(jsonString.utf8)
        do {
            let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]

            if let customDataDict = jsonDict?["custom"] as? [String: String] {
                XCTAssertEqual(customDataDict["name"], "TestEvent", "The custom event name should match the expected value.")
            } else {
                XCTFail("Custom event data is not present in the serialized event.")
            }
        } catch {
            XCTFail("Invalid JSON object: \(error.localizedDescription)")
        }

        func testUserDefinedAttributesSerialization() {
            let attributes: [String: AttributeValue] = ["string_data": .string("Alice"),
                                                        "bool_data": .boolean(true),
                                                        "int_data": .int(1000),
                                                        "float_data": .float(1001.0),
                                                        "long_data": .long(1000000000),
                                                        "double_data": .double(30.2661403415387)]
            guard let jsonString = EventSerializer.serializeUserDefinedAttribute(attributes) else {
                XCTFail("serializeUserDefinedAttribute cannot be nil")
                return
            }
            let jsonData = Data(jsonString.utf8)
            do {
                if let jsonDict = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any] {
                    XCTAssertEqual(jsonDict["string_data"] as? String, "Alice", "The custom event name should match the expected value.")
                    XCTAssertEqual(jsonDict["bool_data"] as? Bool, true, "The custom event name should match the expected value.")
                    XCTAssertEqual(jsonDict["int_data"] as? Int, 1000, "The custom event name should match the expected value.")
                    XCTAssertEqual(jsonDict["float_data"] as? Float, 1001.0, "The custom event name should match the expected value.")
                    XCTAssertEqual(jsonDict["long_data"] as? Int64, 1000000000, "The custom event name should match the expected value.")
                    XCTAssertEqual(jsonDict["double_data"] as? Double, 30.2661403415387, "The custom event name should match the expected value.")
                } else {
                    XCTFail("Could not deserizlize user defined attributes.")
                }
            } catch {
                XCTFail("Invalid JSON object: \(error.localizedDescription)")
            }
        }
    }
} // swiftlint:disable:this file_length
