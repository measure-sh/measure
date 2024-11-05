//
//  EventSerializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/10/24.
//

import Foundation

struct EventSerializer {
    private func getSerialisedData(for event: EventEntity) -> String? { // swiftlint:disable:this cyclomatic_complexity function_body_length
        let eventType = EventType(rawValue: event.type)
        switch eventType {
        case .exception:
            if let exceptionData = event.exception {
                do {
                    let decodedData = try JSONDecoder().decode(Exception.self, from: exceptionData)
                    return serialiseException(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .gestureClick:
            if let gestureClickData = event.gestureClick {
                do {
                    let decodedData = try JSONDecoder().decode(ClickData.self, from: gestureClickData)
                    return serialiseClickData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .gestureLongClick:
            if let gestureLongClickData = event.gestureLongClick {
                do {
                    let decodedData = try JSONDecoder().decode(LongClickData.self, from: gestureLongClickData)
                    return serialiseLongClickData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .gestureScroll:
            if let gestureScrollData = event.gestureScroll {
                do {
                    let decodedData = try JSONDecoder().decode(ScrollData.self, from: gestureScrollData)
                    return serialiseScrollData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .lifecycleApp:
            if let lifecycleAppData = event.lifecycleApp {
                do {
                    let decodedData = try JSONDecoder().decode(ApplicationLifecycleData.self, from: lifecycleAppData)
                    return serialiseApplicationLifecycleData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .lifecycleViewController:
            if let lifecycleViewControllerData = event.lifecycleViewController {
                do {
                    let decodedData = try JSONDecoder().decode(VCLifecycleData.self, from: lifecycleViewControllerData)
                    return serialiseVCLifecycleData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .lifecycleSwiftUI:
            if let lifecycleSwiftUIData = event.lifecycleSwiftUI {
                do {
                    let decodedData = try JSONDecoder().decode(SwiftUILifecycleData.self, from: lifecycleSwiftUIData)
                    return serialiseSwiftUILifecycleData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case nil:
            return nil
        }
    }

    private func serialiseException(_ exceptionData: Exception) -> String {
        let exceptionsSerialized = exceptionData.exceptions.map { serialiseExceptionDetail($0) }.joined(separator: ",")
        let threadsSerialized = exceptionData.threads?.map { serialiseThreadDetail($0) }.joined(separator: ",") ?? "[]"

        var result = "{"
        result += "\"handled\":\(exceptionData.handled),"
        result += "\"exceptions\":[\(exceptionsSerialized)],"
        result += "\"foreground\":\(exceptionData.foreground.map { "\($0)" } ?? "null"),"
        result += "\"threads\":[\(threadsSerialized)]"
        result += "}"
        return result
    }

    private func serialiseExceptionDetail(_ exceptionDetail: ExceptionDetail) -> String {
        let framesSerialized = exceptionDetail.frames?.map { serialiseStackFrame($0) }.joined(separator: ",") ?? "[]"

        var result = "{"
        result += "\"type\":\"\(escapeString(exceptionDetail.type))\","
        result += "\"message\":\"\(escapeString(exceptionDetail.message))\","
        result += "\"frames\":[\(framesSerialized)],"
        result += "\"signal\":\"\(exceptionDetail.signal ?? "null")\","
        result += "\"thread_name\":\"\(escapeString(exceptionDetail.threadName))\","
        result += "\"thread_sequence\":\(exceptionDetail.threadSequence),"
        result += "\"os_build_number\":\"\(escapeString(exceptionDetail.osBuildNumber))\""
        result += "}"
        return result
    }

    private func serialiseThreadDetail(_ threadDetail: ThreadDetail) -> String {
        let framesSerialized = threadDetail.frames.map { serialiseStackFrame($0) }.joined(separator: ",")

        var result = "{"
        result += "\"name\":\"\(escapeString(threadDetail.name))\","
        result += "\"frames\":[\(framesSerialized)],"
        result += "\"sequence\":\(threadDetail.sequence)"
        result += "}"
        return result
    }

    private func serialiseStackFrame(_ stackFrame: StackFrame) -> String {
        var result = "{"
        result += "\"binary_name\":\"\(escapeString(stackFrame.binaryName))\","
        result += "\"binary_address\":\"\(escapeString(stackFrame.binaryAddress))\","
        result += "\"offset\":\"\(escapeString(stackFrame.offset))\","
        result += "\"frame_index\":\(stackFrame.frameIndex),"
        result += "\"symbol_address\":\"\(escapeString(stackFrame.symbolAddress))\","
        result += "\"in_app\":\(stackFrame.inApp)"
        result += "}"
        return result
    }

    private func escapeString(_ string: String) -> String {
        return string
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
    }

    private func serialiseClickData(_ clickData: ClickData) -> String? {
        var result = "{"
        result += "\"target\":\"\(clickData.target ?? "null")\","
        result += "\"target_id\":\"\(clickData.targetId ?? "null")\","
        result += "\"width\":\(clickData.width ?? 0),"
        result += "\"height\":\(clickData.height ?? 0),"
        result += "\"x\":\(clickData.x),"
        result += "\"y\":\(clickData.y),"
        result += "\"touch_down_time\":\(clickData.touchDownTime),"
        result += "\"touch_up_time\":\(clickData.touchUpTime)"
        result += "}"
        return result
    }

    private func serialiseLongClickData(_ longClickData: LongClickData) -> String? {
        var result = "{"
        result += "\"target\":\"\(longClickData.target ?? "null")\","
        result += "\"target_id\":\"\(longClickData.targetId ?? "null")\","
        result += "\"width\":\(longClickData.width ?? 0),"
        result += "\"height\":\(longClickData.height ?? 0),"
        result += "\"x\":\(longClickData.x),"
        result += "\"y\":\(longClickData.y),"
        result += "\"touch_down_time\":\(longClickData.touchDownTime),"
        result += "\"touch_up_time\":\(longClickData.touchUpTime)"
        result += "}"
        return result
    }

    private func serialiseScrollData(_ scrollData: ScrollData) -> String {
        var result = "{"
        result += "\"target\":\"\(scrollData.target ?? "null")\","
        result += "\"target_id\":\"\(scrollData.targetId ?? "null")\","
        result += "\"x\":\(scrollData.x),"
        result += "\"y\":\(scrollData.y),"
        result += "\"end_x\":\(scrollData.endX),"
        result += "\"end_y\":\(scrollData.endY),"
        result += "\"direction\":\"\(scrollData.direction.rawValue)\","
        result += "\"touch_down_time\":\(scrollData.touchDownTime),"
        result += "\"touch_up_time\":\(scrollData.touchUpTime)"
        result += "}"
        return result
    }

    private func serialiseApplicationLifecycleData(_ applicationLifecycleData: ApplicationLifecycleData) -> String {
        var result = "{"
        result += "\"type\":\"\(applicationLifecycleData.type.rawValue)\","
        result += "}"
        return result
    }

    private func serialiseVCLifecycleData(_ lifecycleViewController: VCLifecycleData) -> String {
        var result = "{"
        result += "\"type\":\"\(lifecycleViewController.type)\","
        result += "\"class_name\":\"\(lifecycleViewController.className)\","
        result += "}"
        return result
    }

    private func serialiseSwiftUILifecycleData(_ swiftUILifecycleData: SwiftUILifecycleData) -> String {
        var result = "{"
        result += "\"type\":\"\(swiftUILifecycleData.type.rawValue)\","
        result += "\"view_name\":\"\(swiftUILifecycleData.viewName)\","
        result += "}"
        return result
    }

    private func getSerialisedAttributes(for event: EventEntity) -> String? {
        let decodedAttributes: Attributes?
        if let attributeData = event.attributes {
            do {
                decodedAttributes = try JSONDecoder().decode(Attributes.self, from: attributeData)
                var result = "{"
                    result += "\"thread_name\":\"\(decodedAttributes?.threadName ?? "null")\","
                    result += "\"device_name\":\"\(decodedAttributes?.deviceName ?? "null")\","
                    result += "\"device_model\":\"\(decodedAttributes?.deviceModel ?? "null")\","
                    result += "\"device_manufacturer\":\"\(decodedAttributes?.deviceManufacturer ?? "null")\","
                    result += "\"device_type\":\"\(decodedAttributes?.deviceType?.rawValue ?? "null")\","
                    result += "\"device_is_foldable\":\(decodedAttributes?.deviceIsFoldable ?? false),"
                    result += "\"device_is_physical\":\(decodedAttributes?.deviceIsPhysical ?? true),"
                    result += "\"device_density_dpi\":\(decodedAttributes?.deviceDensityDpi ?? 0),"
                    result += "\"device_width_px\":\(decodedAttributes?.deviceWidthPx ?? 0),"
                    result += "\"device_height_px\":\(decodedAttributes?.deviceHeightPx ?? 0),"
                    result += "\"device_density\":\(decodedAttributes?.deviceDensity ?? 0),"
                    result += "\"device_locale\":\"\(decodedAttributes?.deviceLocale ?? "null")\","
                    result += "\"os_name\":\"\(decodedAttributes?.osName ?? "null")\","
                    result += "\"os_version\":\"\(decodedAttributes?.osVersion ?? "null")\","
                    result += "\"platform\":\"\(decodedAttributes?.platform ?? "null")\","
                    result += "\"network_type\":\"\(decodedAttributes?.networkType?.rawValue ?? "null")\","
                    result += "\"network_generation\":\"\(decodedAttributes?.networkGeneration?.rawValue ?? "null")\","
                    result += "\"network_provider\":\"\(decodedAttributes?.networkProvider ?? "null")\","
                    result += "\"installation_id\":\"\(decodedAttributes?.installationId ?? "null")\","
                    result += "\"user_id\":\"\(decodedAttributes?.userId ?? "null")\","
                    result += "\"device_cpu_arch\":\"\(decodedAttributes?.deviceCpuArch ?? "null")\","
                    result += "\"app_version\":\"\(decodedAttributes?.appVersion ?? "null")\","
                    result += "\"app_build\":\"\(decodedAttributes?.appBuild ?? "null")\","
                    result += "\"measure_sdk_version\":\"\(decodedAttributes?.measureSdkVersion ?? "null")\","
                    result += "\"app_unique_id\":\"\(decodedAttributes?.appUniqueId ?? "null")\""
                    result += "}"
                return result
            } catch {
                return nil
            }
        } else {
            return nil
        }
    }

    func getSerialisedEvent(for event: EventEntity) -> String? {
        guard let serialisedAttributes = getSerialisedAttributes(for: event),
              let serialisedData = getSerialisedData(for: event) else {
            return nil
        }
        var result = "{"
        result += "\"id\":\"\(event.id)\","
        result += "\"session_id\":\"\(event.sessionId)\","
        result += "\"timestamp\":\"\(event.timestamp)\","
        result += "\"type\":\"\(event.type)\","
        result += "\"\(event.type)\":\(serialisedData),"
        result += "\"attribute\":\(serialisedAttributes),"
        result += "\"user_triggered\":\(event.userTriggered)"
        result += "}"
        return result
    }
}
