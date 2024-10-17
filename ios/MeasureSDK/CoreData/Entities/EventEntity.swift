//
//  EventEntity.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/09/24.
//

import Foundation

struct EventEntity {  // swiftlint:disable:this type_body_length
    let id: String
    let sessionId: String
    let timestamp: String
    let type: String
    let exception: Data?
    let attachments: Data?
    let attributes: Data?
    let gestureClick: Data?
    let gestureLongClick: Data?
    let gestureScroll: Data?
    let userTriggered: Bool

    init<T: Codable>(_ event: Event<T>) { // swiftlint:disable:this cyclomatic_complexity function_body_length
        self.id = event.id
        self.sessionId = event.sessionId
        self.timestamp = event.timestamp
        self.type = event.type.rawValue
        self.userTriggered = event.userTriggered

        if let exception = event.data as? Exception {
            do {
                let data = try JSONEncoder().encode(exception)
                self.exception = data
            } catch {
                self.exception = nil
            }
        } else {
            self.exception = nil
        }

        if let gestureClick = event.data as? ClickData {
            do {
                let data = try JSONEncoder().encode(gestureClick)
                self.gestureClick = data
            } catch {
                self.gestureClick = nil
            }
        } else {
            self.gestureClick = nil
        }

        if let gestureLongClick = event.data as? LongClickData {
            do {
                let data = try JSONEncoder().encode(gestureLongClick)
                self.gestureLongClick = data
            } catch {
                self.gestureLongClick = nil
            }
        } else {
            self.gestureLongClick = nil
        }

        if let gestureScroll = event.data as? ScrollData {
            do {
                let data = try JSONEncoder().encode(gestureScroll)
                self.gestureScroll = data
            } catch {
                self.gestureScroll = nil
            }
        } else {
            self.gestureScroll = nil
        }

        if let attributes = event.attributes {
            do {
                let data = try JSONEncoder().encode(attributes)
                self.attributes = data
            } catch {
                self.attributes = nil
            }
        } else {
            self.attributes = nil
        }

        do {
            let data = try JSONEncoder().encode(event.attachments)
            self.attachments = data
        } catch {
            self.attachments = nil
        }
    }

    init(id: String,
         sessionId: String,
         timestamp: String,
         type: String,
         exception: Data?,
         attachments: Data?,
         attributes: Data?,
         gestureClick: Data?,
         gestureLongClick: Data?,
         gestureScroll: Data?,
         userTriggered: Bool) {
        self.id = id
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.type = type
        self.exception = exception
        self.attachments = attachments
        self.attributes = attributes
        self.userTriggered = userTriggered
        self.gestureClick = gestureClick
        self.gestureLongClick = gestureLongClick
        self.gestureScroll = gestureScroll
    }

    func getEvent<T: Codable>() -> Event<T> { // swiftlint:disable:this cyclomatic_complexity
        var decodedData: T?
        if let exceptionData = self.exception {
            do {
                decodedData = try JSONDecoder().decode(T.self, from: exceptionData)
            } catch {}
        }

        if let gestureClickData = self.gestureClick {
            do {
                decodedData = try JSONDecoder().decode(T.self, from: gestureClickData)
            } catch {}
        }

        if let gestureLongClickData = self.gestureLongClick {
            do {
                decodedData = try JSONDecoder().decode(T.self, from: gestureLongClickData)
            } catch {}
        }

        if let gestureScrollData = self.gestureScroll {
            do {
                decodedData = try JSONDecoder().decode(T.self, from: gestureScrollData)
            } catch {}
        }

        let decodedAttachments: [Attachment]?
        if let attachmentData = self.attachments {
            do {
                decodedAttachments = try JSONDecoder().decode([Attachment].self, from: attachmentData)
            } catch {
                decodedAttachments = nil
            }
        } else {
            decodedAttachments = nil
        }

        let decodedAttributes: Attributes?
        if let attributeData = self.attributes {
            do {
                decodedAttributes = try JSONDecoder().decode(Attributes.self, from: attributeData)
            } catch {
                decodedAttributes = nil
            }
        } else {
            decodedAttributes = nil
        }

        return Event(id: self.id,
                     sessionId: self.sessionId,
                     timestamp: self.timestamp,
                     type: EventType(rawValue: self.type) ?? .exception,
                     data: decodedData,
                     attachments: decodedAttachments ?? [Attachment](),
                     attributes: decodedAttributes,
                     userTriggered: self.userTriggered)
    }

    private func getSerialisedData() -> String? {  // swiftlint:disable:this cyclomatic_complexity
        let eventType = EventType(rawValue: type)
        switch eventType {
        case .exception:
            if let exceptionData = self.exception {
                do {
                    let decodedData = try JSONDecoder().decode(Exception.self, from: exceptionData)
                    return serialiseException(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .gestureClick:
            if let gestureClickData = self.gestureClick {
                do {
                    let decodedData = try JSONDecoder().decode(ClickData.self, from: gestureClickData)
                    return serialiseClickData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .gestureLongClick:
            if let gestureLongClickData = self.gestureLongClick {
                do {
                    let decodedData = try JSONDecoder().decode(LongClickData.self, from: gestureLongClickData)
                    return serialiseLongClickData(decodedData)
                } catch {
                    return nil
                }
            }
            return nil
        case .gestureScroll:
            if let gestureScrollData = self.gestureScroll {
                do {
                    let decodedData = try JSONDecoder().decode(ScrollData.self, from: gestureScrollData)
                    return serialiseScrollData(decodedData)
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
        let threadsSerialized = exceptionData.threads?.map { serialiseThreadDetail($0) }.joined(separator: ",") ?? "null"

        var result = "{"
        result += "\"handled\":\(exceptionData.handled),"
        result += "\"exceptions\":[\(exceptionsSerialized)],"
        result += "\"foreground\":\(exceptionData.foreground.map { "\($0)" } ?? "null"),"
        result += "\"threads\":[\(threadsSerialized)]"
        result += "}"
        return result
    }

    private func serialiseExceptionDetail(_ exceptionDetail: ExceptionDetail) -> String {
        let framesSerialized = exceptionDetail.frames?.map { serialiseStackFrame($0) }.joined(separator: ",") ?? "null"

        var result = "{"
        result += "\"type\":\"\(exceptionDetail.type)\","
        result += "\"message\":\"\(exceptionDetail.message)\","
        result += "\"frames\":[\(framesSerialized)],"
        result += "\"signal\":\"\(exceptionDetail.signal ?? "null")\","
        result += "\"thread_name\":\"\(exceptionDetail.threadName)\","
        result += "\"thread_sequence\":\(exceptionDetail.threadSequence),"
        result += "\"os_build_number\":\"\(exceptionDetail.osBuildNumber)\""
        result += "}"
        return result
    }

    private func serialiseThreadDetail(_ threadDetail: ThreadDetail) -> String {
        let framesSerialized = threadDetail.frames.map { serialiseStackFrame($0) }.joined(separator: ",")

        var result = "{"
        result += "\"name\":\"\(threadDetail.name)\","
        result += "\"frames\":[\(framesSerialized)],"
        result += "\"sequence\":\(threadDetail.sequence)"
        result += "}"
        return result
    }

    private func serialiseStackFrame(_ stackFrame: StackFrame) -> String {
        var result = "{"
        result += "\"binary_name\":\"\(stackFrame.binaryName)\","
        result += "\"binary_address\":\"\(stackFrame.binaryAddress)\","
        result += "\"offset\":\(stackFrame.offset),"
        result += "\"frame_index\":\(stackFrame.frameIndex),"
        result += "\"symbol_address\":\"\(stackFrame.symbolAddress)\","
        result += "\"in_app\":\(stackFrame.inApp)"
        result += "}"
        return result
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

    private func getSerialisedAttributes() -> String? {
        let decodedAttributes: Attributes?
        if let attributeData = self.attributes {
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

    func getSerialisedEvent() -> String? {
        guard let serialisedAttributes = getSerialisedAttributes(), let serialisedData = getSerialisedData() else {
            return nil
        }
        var result = "{"
        result += "\"id\":\"\(id)\","
        result += "\"session_id\":\"\(sessionId)\","
        result += "\"timestamp\":\"\(timestamp)\","
        result += "\"type\":\"\(type)\","
        result += "\"\(type)\":\(serialisedData),"
        result += "\"attribute\":\(serialisedAttributes),"
        result += "\"user_triggered\":\(userTriggered)"
        result += "}"
        return result
    }
}
