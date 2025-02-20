//
//  EventSerializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/10/24.
//

import Foundation

struct EventSerializer { // swiftlint:disable:this type_body_length
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
        case .cpuUsage:
            if let cpuUsageData = event.cpuUsage {
                do {
                    let decodedData = try JSONDecoder().decode(CpuUsageData.self, from: cpuUsageData)
                    return serialiseCpuUsageData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .memoryUsageAbsolute:
            if let memoryUsageData = event.memoryUsage {
                do {
                    let decodedData = try JSONDecoder().decode(MemoryUsageData.self, from: memoryUsageData)
                    return serialiseMemoryUsageData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .coldLaunch:
            if let coldLaunchData = event.coldLaunch {
                do {
                    let decodedData = try JSONDecoder().decode(ColdLaunchData.self, from: coldLaunchData)
                    return serialiseColdLaunchData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .warmLaunch:
            if let warmLaunchData = event.warmLaunch {
                do {
                    let decodedData = try JSONDecoder().decode(WarmLaunchData.self, from: warmLaunchData)
                    return serialiseWarmLaunchData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .hotLaunch:
            if let hotLaunchData = event.hotLaunch {
                do {
                    let decodedData = try JSONDecoder().decode(HotLaunchData.self, from: hotLaunchData)
                    return serialiseHotLaunchData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .http:
            if let httpData = event.http {
                do {
                    let decodedData = try JSONDecoder().decode(HttpData.self, from: httpData)
                    return serialiseHttpData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .networkChange:
            if let networkChangeData = event.networkChange {
                do {
                    let decodedData = try JSONDecoder().decode(NetworkChangeData.self, from: networkChangeData)
                    return serialiseNetworkChangeData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .custom:
            if let customEventData = event.customEvent {
                do {
                    let decodedData = try JSONDecoder().decode(CustomEventData.self, from: customEventData)
                    return serialiseCustomEventData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .screenView:
            if let screenViewData = event.screenView {
                do {
                    let decodedData = try JSONDecoder().decode(ScreenViewData.self, from: screenViewData)
                    return serialiseScreenViewData(decodedData)
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
        let threadsSerialized = exceptionData.threads?.map { serialiseThreadDetail($0) }.joined(separator: ",") ?? ""
        let binaryImagesSerialized = exceptionData.binaryImages?.map { serialiseBinaryImage($0) }.joined(separator: ",") ?? ""

        var result = "{"
        result += "\"handled\":\(exceptionData.handled),"
        result += "\"exceptions\":[\(exceptionsSerialized)],"
        result += "\"foreground\":\(exceptionData.foreground.map { "\($0)" } ?? ""),"
        result += "\"binary_images\":[\(binaryImagesSerialized)],"
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
        result += "\"signal\":\"\(exceptionDetail.signal ?? "")\","
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
        result += "\"offset\":\(stackFrame.offset),"
        result += "\"frame_index\":\(stackFrame.frameIndex),"
        result += "\"symbol_address\":\"\(escapeString(stackFrame.symbolAddress))\","
        result += "\"in_app\":\(stackFrame.inApp)"
        result += "}"
        return result
    }

    private func serialiseBinaryImage(_ binaryImages: BinaryImage) -> String {
        var result = "{"
        result += "\"start_addr\":\"\(binaryImages.startAddress)\","
        result += "\"end_addr\":\"\(binaryImages.endAddress)\","
        result += "\"system\":\(binaryImages.system),"
        result += "\"name\":\"\(binaryImages.name)\","
        result += "\"arch\":\"\(binaryImages.arch)\","
        result += "\"uuid\":\"\(binaryImages.uuid)\","
        result += "\"path\":\"\(binaryImages.path)\""
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
        result += "\"target\":\"\(clickData.target ?? "")\","
        result += "\"target_id\":\"\(clickData.targetId ?? "")\","
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
        result += "\"target\":\"\(longClickData.target ?? "")\","
        result += "\"target_id\":\"\(longClickData.targetId ?? "")\","
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
        result += "\"target\":\"\(scrollData.target ?? "")\","
        result += "\"target_id\":\"\(scrollData.targetId ?? "")\","
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
        result += "\"type\":\"\(applicationLifecycleData.type.rawValue)\""
        result += "}"
        return result
    }

    private func serialiseVCLifecycleData(_ lifecycleViewController: VCLifecycleData) -> String {
        var result = "{"
        result += "\"type\":\"\(lifecycleViewController.type)\","
        result += "\"class_name\":\"\(lifecycleViewController.className)\""
        result += "}"
        return result
    }

    private func serialiseSwiftUILifecycleData(_ swiftUILifecycleData: SwiftUILifecycleData) -> String {
        var result = "{"
        result += "\"type\":\"\(swiftUILifecycleData.type.rawValue)\","
        result += "\"class_name\":\"\(swiftUILifecycleData.className)\""
        result += "}"
        return result
    }

    private func serialiseCpuUsageData(_ cpuUsageData: CpuUsageData) -> String {
        var result = "{"
        result += "\"num_cores\":\(cpuUsageData.numCores),"
        result += "\"clock_speed\":\(cpuUsageData.clockSpeed),"
        result += "\"start_time\":\(cpuUsageData.startTime),"
        result += "\"uptime\":\(cpuUsageData.uptime),"
        result += "\"utime\":\(cpuUsageData.utime),"
        result += "\"cutime\":\(cpuUsageData.cutime),"
        result += "\"cstime\":\(cpuUsageData.cstime),"
        result += "\"stime\":\(cpuUsageData.stime),"
        result += "\"interval\":\(cpuUsageData.interval),"
        result += "\"percentage_usage\":\(cpuUsageData.percentageUsage)"
        result += "}"
        return result
    }

    private func serialiseMemoryUsageData(_ memoryUsageData: MemoryUsageData) -> String {
        var result = "{"
        result += "\"interval\":\(memoryUsageData.interval),"
        result += "\"used_memory\":\(memoryUsageData.usedMemory),"
        result += "\"max_memory\":\(memoryUsageData.maxMemory)"
        result += "}"
        return result
    }

    private func serialiseColdLaunchData(_ coldLaunchData: ColdLaunchData) -> String {
        var result = "{"
        result += "\"process_start_uptime\":\(coldLaunchData.processStartUptime ?? 0),"
        result += "\"process_start_requested_uptime\":\(coldLaunchData.processStartRequestedUptime ?? 0),"
        result += "\"content_provider_attach_uptime\":\(coldLaunchData.contentProviderAttachUptime ?? 0),"
        result += "\"on_next_draw_uptime\":\(coldLaunchData.onNextDrawUptime),"
        result += "\"launched_activity\":\"\(coldLaunchData.launchedActivity)\","
        result += "\"has_saved_state\":\(coldLaunchData.hasSavedState),"
        result += "\"intent_data\":\"\(coldLaunchData.intentData ?? "")\""
        result += "}"
        return result
    }

    private func serialiseWarmLaunchData(_ warmLaunchData: WarmLaunchData) -> String {
        var result = "{"
        result += "\"app_visible_uptime\":\(warmLaunchData.appVisibleUptime ?? 0),"
        result += "\"on_next_draw_uptime\":\(warmLaunchData.onNextDrawUptime),"
        result += "\"launched_activity\":\"\(warmLaunchData.launchedActivity)\","
        result += "\"has_saved_state\":\(warmLaunchData.hasSavedState),"
        result += "\"intent_data\":\"\(warmLaunchData.intentData ?? "")\""
        result += "}"
        return result
    }

    private func serialiseHotLaunchData(_ hotLaunchData: HotLaunchData) -> String {
        var result = "{"
        result += "\"app_visible_uptime\":\(hotLaunchData.appVisibleUptime ?? 0),"
        result += "\"on_next_draw_uptime\":\(hotLaunchData.onNextDrawUptime),"
        result += "\"launched_activity\":\"\(hotLaunchData.launchedActivity)\","
        result += "\"has_saved_state\":\(hotLaunchData.hasSavedState),"
        result += "\"intent_data\":\"\(hotLaunchData.intentData ?? "")\""
        result += "}"
        return result
    }

    private func serialiseHttpData(_ httpData: HttpData) -> String {
        var result = "{"
        result += "\"url\":\"\(httpData.url)\","
        result += "\"method\":\"\(httpData.method)\","

        if let statusCode = httpData.statusCode {
            result += "\"status_code\":\(statusCode),"
        }

        if let startTime = httpData.startTime {
            result += "\"start_time\":\(startTime),"
        }

        if let endTime = httpData.endTime {
            result += "\"end_time\":\(endTime),"
        }

        if let failureReason = httpData.failureReason {
            result += "\"failure_reason\":\"\(failureReason)\","
        }

        if let failureDescription = httpData.failureDescription {
            result += "\"failure_description\":\"\(failureDescription)\","
        }

        if let requestHeaders = httpData.requestHeaders {
            let headers = requestHeaders.map { "\"\($0.key)\":\"\($0.value.sanitizeRequestBody())\"" }.joined(separator: ",")
            result += "\"request_headers\":{\(headers)},"
        }

        if let responseHeaders = httpData.responseHeaders {
            let headers = responseHeaders.map { "\"\($0.key)\":\"\($0.value.sanitizeRequestBody())\"" }.joined(separator: ",")
            result += "\"response_headers\":{\(headers)},"
        }

        if let requestBody = httpData.requestBody {
            result += "\"request_body\":\"\(requestBody)\","
        }

        if let responseBody = httpData.responseBody {
            result += "\"response_body\":\"\(responseBody)\","
        }

        result += "\"client\":\"\(httpData.client)\""
        result += "}"

        return result
    }

    private func serialiseNetworkChangeData(_ networkChangeData: NetworkChangeData) -> String {
        var result = "{"
        result += "\"network_type\":\"\(networkChangeData.networkType)\","
        result += "\"network_provider\":\"\(networkChangeData.networkProvider)\","
        result += "\"network_generation\":\"\(networkChangeData.networkGeneration)\","
        result += "\"previous_network_type\":\"\(networkChangeData.previousNetworkType)\","
        result += "\"previous_network_generation\":\"\(networkChangeData.previousNetworkGeneration)\""
        result += "}"
        return result
    }

    private func serialiseCustomEventData(_ customEventData: CustomEventData) -> String {
        var result = "{"
        result += "\"name\":\"\(customEventData.name)\""
        result += "}"
        return result
    }

    private func serialiseScreenViewData(_ screenViewData: ScreenViewData) -> String {
        var result = "{"
        result += "\"name\":\"\(screenViewData.name)\""
        result += "}"
        return result
    }

    private func getSerialisedAttachments(for event: EventEntity) -> String? {
        if let attachmentData = event.attachments {
            do {
                let decodedAttachments = try JSONDecoder().decode([Attachment].self, from: attachmentData)
                if decodedAttachments.isEmpty {
                    return nil
                }
                var result = "["
                for attachment in decodedAttachments {
                    result += "{"
                    result += "\"id\":\"\(attachment.id)\","
                    result += "\"name\":\"\(attachment.name)\","
                    result += "\"type\":\"\(attachment.type.rawValue)\""
                    result += "},"
                }
                result = String(result.dropLast())
                result += "]"
                return result
            } catch {
                return nil
            }
        } else {
            return nil
        }
    }

    private func getSerialisedAttributes(for event: EventEntity) -> String? {
        let decodedAttributes: Attributes?
        if let attributeData = event.attributes {
            do {
                decodedAttributes = try JSONDecoder().decode(Attributes.self, from: attributeData)
                var result = "{"
                    result += "\"thread_name\":\"\(decodedAttributes?.threadName ?? "")\","
                    result += "\"device_name\":\"\(decodedAttributes?.deviceName ?? "")\","
                    result += "\"device_model\":\"\(decodedAttributes?.deviceModel ?? "")\","
                    result += "\"device_manufacturer\":\"\(decodedAttributes?.deviceManufacturer ?? "")\","
                    result += "\"device_type\":\"\(decodedAttributes?.deviceType?.rawValue ?? "")\","
                    result += "\"device_is_foldable\":\(decodedAttributes?.deviceIsFoldable ?? false),"
                    result += "\"device_is_physical\":\(decodedAttributes?.deviceIsPhysical ?? true),"
                    result += "\"device_density_dpi\":\(decodedAttributes?.deviceDensityDpi ?? 0),"
                    result += "\"device_width_px\":\(decodedAttributes?.deviceWidthPx ?? 0),"
                    result += "\"device_height_px\":\(decodedAttributes?.deviceHeightPx ?? 0),"
                    result += "\"device_density\":\(decodedAttributes?.deviceDensity ?? 0),"
                    result += "\"device_locale\":\"\(decodedAttributes?.deviceLocale ?? "")\","
                    result += "\"os_name\":\"\(decodedAttributes?.osName ?? "")\","
                    result += "\"os_version\":\"\(decodedAttributes?.osVersion ?? "")\","
                    result += "\"platform\":\"\(decodedAttributes?.platform ?? "")\","
                    result += "\"network_type\":\"\(decodedAttributes?.networkType?.rawValue ?? "")\","
                    result += "\"network_generation\":\"\(decodedAttributes?.networkGeneration?.rawValue ?? "")\","
                    result += "\"network_provider\":\"\(decodedAttributes?.networkProvider ?? "")\","
                    result += "\"installation_id\":\"\(decodedAttributes?.installationId ?? "")\","
                    result += "\"user_id\":\"\(decodedAttributes?.userId ?? "")\","
                    result += "\"device_cpu_arch\":\"\(decodedAttributes?.deviceCpuArch ?? "")\","
                    result += "\"app_version\":\"\(decodedAttributes?.appVersion ?? "")\","
                    result += "\"app_build\":\"\(decodedAttributes?.appBuild ?? "")\","
                    result += "\"measure_sdk_version\":\"\(decodedAttributes?.measureSdkVersion ?? "")\","
                    result += "\"device_low_power_mode\":\(decodedAttributes?.deviceLowPowerMode ?? false),"
                    result += "\"app_unique_id\":\"\(decodedAttributes?.appUniqueId ?? "")\""
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
        if let userDefinedAttributes = event.userDefinedAttributes {
            result += "\"user_defined_attribute\":\(userDefinedAttributes),"
        }
        if let attachments = getSerialisedAttachments(for: event) {
            result += "\"attachments\":\(attachments),"
        }
        result += "\"user_triggered\":\(event.userTriggered)"
        result += "}"
        return result
    }

    static func serializeUserDefinedAttribute(_ userDefinedAttribute: [String: AttributeValue]?) -> String? {
        guard let userDefinedAttribute = userDefinedAttribute else { return nil }

        var result = "{"
        for (key, value) in userDefinedAttribute {
            result += "\"\(key)\":\(value.serialize()),"
        }
        result = String(result.dropLast())
        result += "}"
        return result
    }
} // swiftlint:disable:this file_length
