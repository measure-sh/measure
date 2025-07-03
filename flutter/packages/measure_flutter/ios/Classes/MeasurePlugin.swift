import Flutter
import UIKit
import Measure

public class MeasurePlugin: NSObject, FlutterPlugin {
    private var channel: FlutterMethodChannel?

    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(name: "measure_flutter", binaryMessenger: registrar.messenger())
        let instance = MeasurePlugin()
        instance.channel = channel
        registrar.addMethodCallDelegate(instance, channel: channel)
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        do {
            switch call.method {
            case MethodConstants.functionTrackEvent:
                try handleTrackEvent(call, result: result)
            case MethodConstants.functionTriggerNativeCrash:
                triggerNativeCrash()
            case MethodConstants.functionInitializeNativeSdk:
                try initializeNativeSdk(call, result: result)
            case MethodConstants.functionStart:
                try start(call, result: result)
            case MethodConstants.functionStop:
                try stop(call, result: result)
            case MethodConstants.functionGetSessionId:
                try getSessionId(call, result: result)
            case MethodConstants.functionTrackSpan:
                try trackSpan(call, result: result)
            case MethodConstants.functionSetUserId:
                try setUserId(call, result: result)
            case MethodConstants.functionClearUserId:
                try clearUserId(result: result)
            case MethodConstants.functionGetAttachmentDirectory:
                try getAttachmentDirectory(result: result)
            case MethodConstants.functionEnableShakeDetection:
                try enableShakeDetector()
            case MethodConstants.functionDisableShakeDetection:
                try disableShakeDetector()
            default:
                result(FlutterMethodNotImplemented)
            }
        } catch let error as MethodArgumentError {
            result(FlutterError(code: error.code, message: error.message, details: error.details))
        } catch {
            result(FlutterError(
                code: ErrorCode.errorUnknown,
                message: "Unexpected method channel error when calling \(call.method)",
                details: error.localizedDescription
            ))
        }
    }

    private func handleTrackEvent(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        let reader = MethodCallReader(call)
        var eventData: [String: Any?] = try reader.requireArg(MethodConstants.argEventData)
        let eventType: String = try reader.requireArg(MethodConstants.argEventType)
        let timestamp: Int64 = try reader.requireArg(MethodConstants.argTimestamp)
        let rawAttributes: [String: Any] = try reader.requireArg(MethodConstants.argUserDefinedAttrs)
        let convertedAttributes = try AttributeConverter.convertAttributes(rawAttributes)
        let userTriggered: Bool = try reader.requireArg(MethodConstants.argUserTriggered)
        let threadName: String? = reader.optionalArg(MethodConstants.argThreadName)
        let rawAttachments: String? = reader.optionalArg(MethodConstants.argAttachments)
        let convertedAttachments = try AttachmentsConverter.convertAttachments(rawAttachments)

        trackEvent(
            data: &eventData,
            type: eventType,
            timestamp: timestamp,
            userDefinedAttrs: convertedAttributes,
            userTriggered: userTriggered,
            sessionId: nil,
            threadName: threadName,
            attachments: convertedAttachments
        )
        result(nil)
    }

    // swiftlint:disable:next function_parameter_count
    private func trackEvent(
        data: inout [String: Any?],
        type: String,
        timestamp: Int64,
        userDefinedAttrs: [String: AttributeValue],
        userTriggered: Bool,
        sessionId: String?,
        threadName: String?,
        attachments: [Attachment]) {
            Measure.internalTrackEvent(
                data: &data,
                type: type,
                timestamp: timestamp,
                attributes: [:],
                userDefinedAttrs: userDefinedAttrs,
                userTriggered: userTriggered,
                sessionId: sessionId,
                threadName: threadName,
                attachments: attachments
            )
        }

    private func triggerNativeCrash() {
        let optionalString: String? = nil
        _ = optionalString!
    }

    private func initializeNativeSdk(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        let reader = MethodCallReader(call)
        let argConfig: [String: Any?] = try reader.requireArg(MethodConstants.argConfig)
        let argClientInfo: [String: Any?] = try reader.requireArg(MethodConstants.argClientInfo)

        let jsonConfig = try JSONSerialization.data(withJSONObject: argConfig, options: [])
        let config = try JSONDecoder().decode(BaseMeasureConfig.self, from: jsonConfig)

        let jsonClientInfo = try JSONSerialization.data(withJSONObject: argClientInfo, options: [])
        let clientInfo = try JSONDecoder().decode(ClientInfo.self, from: jsonClientInfo)

        Measure.initialize(with: clientInfo, config: config)
        result(nil)
    }

    private func start(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        Measure.start()
        result(nil)
    }

    private func stop(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        Measure.stop()
        result(nil)
    }

    private func getSessionId(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        let id = Measure.getSessionId()
        result(id)
    }

    private func trackSpan(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        let reader = MethodCallReader(call)
        let name: String = try reader.requireArg(MethodConstants.argSpanName)
        let traceId: String = try reader.requireArg(MethodConstants.argSpanTraceId)
        let spanId: String = try reader.requireArg(MethodConstants.argSpanId)
        let parentId: String? = reader.optionalArg(MethodConstants.argSpanParentId)
        let startTime: Int64 = try reader.requireArg(MethodConstants.argSpanStartTime)
        let endTime: Int64 = try reader.requireArg(MethodConstants.argSpanEndTime)
        let duration: Int64 = try reader.requireArg(MethodConstants.argSpanDuration)
        let status: Int64 = try reader.requireArg(MethodConstants.argSpanStatus)
        let attributes: [String: Any?]? = reader.optionalArg(MethodConstants.argSpanAttributes)
        let rawUserDefinedAttrs: [String: Any] = try reader.requireArg(MethodConstants.argSpanUserDefinedAttrs)
        let userDefinedAttrs = try AttributeConverter.convertAttributes(rawUserDefinedAttrs)
        let checkpoints: [String: Int64] = try reader.requireArg(MethodConstants.argSpanCheckpoints)
        let hasEnded: Bool = try reader.requireArg(MethodConstants.argSpanHasEnded)
        let isSampled: Bool = try reader.requireArg(MethodConstants.argSpanIsSampled)

        Measure.internalTrackSpan(
            name: name,
            traceId: traceId,
            spanId: spanId,
            parentId: parentId,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            status: status,
            attributes: attributes ?? [:],
            userDefinedAttrs: userDefinedAttrs,
            checkpoints: checkpoints,
            hasEnded: hasEnded,
            isSampled: isSampled
        )
    }

    private func setUserId(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        let reader = MethodCallReader(call)
        let userId: String = try reader.requireArg(MethodConstants.argUserId)
        Measure.setUserId(userId)
        result(nil)
    }

    private func clearUserId(result: @escaping FlutterResult) throws {
        Measure.clearUserId()
        result(nil)
    }

    private func getAttachmentDirectory(result: @escaping FlutterResult) throws {
        let path = Measure.internalGetAttachmentDirectory()
        result(path)
    }

    private func enableShakeDetector() throws {
        Measure.onShake {
            self.channel?.invokeMethod(MethodConstants.callbackOnShakeDetected, arguments: nil)
        }
    }

    private func disableShakeDetector() throws {
        Measure.onShake(nil)
    }
}
