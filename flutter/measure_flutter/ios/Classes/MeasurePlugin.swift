import Flutter
import UIKit
import MeasureSDK

public class MeasurePlugin: NSObject, FlutterPlugin {
    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(name: "measure_flutter", binaryMessenger: registrar.messenger())
        let instance = MeasurePlugin()
        registrar.addMethodCallDelegate(instance, channel: channel)
    }
    
    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        do {
            switch call.method {
            case MethodConstants.functionTrackCustomEvent:
                try handleTrackCustomEvent(call, result: result)
            default:
                result(FlutterMethodNotImplemented)
            }
        } catch let error as MethodArgumentError {
            result(FlutterError(code: error.code, message: error.message, details: error.details))
        } catch {
            result(FlutterError(
                code: MethodConstants.errorUnknown,
                message: "Unexpected method channel error when calling \(call.method)",
                details: error.localizedDescription
            ))
        }
    }
    
    private func handleTrackCustomEvent(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        let reader = MethodCallReader(call)
        let name: String = try reader.requireArg(MethodConstants.argName)
        let timestamp: Int64 = try reader.requireArg(MethodConstants.argTimestamp)
        let rawAttributes: [String: Any] = try reader.requireArg(MethodConstants.argAttributes)
        let convertedAttributes = try AttributeConverter.convertAttributes(rawAttributes)
        trackEvent(
            data: CustomEventData(name),
            type: EventType.CUSTOM,
            timestamp: timestamp,
            userDefinedAttrs: convertedAttributes,
            userTriggered: true
        )
        result(nil)
    }
    
    private func trackEvent<T>(
        data: T,
        type: String,
        timestamp: Int64,
        userDefinedAttrs: [String: AttributeValue] = [:],
        attachments: [Attachment] = [],
        userTriggered: Bool,
        sessionId: String? = nil
    ) {
        var attributes: [String: Any?] = [
            Attribute.PLATFORM_KEY: "flutter"
        ]
        
        Measure.internalTrackEvent(
            data: data,
            type: type,
            timestamp: timestamp,
            attributes: attributes,
            userDefinedAttrs: userDefinedAttrs,
            attachments: attachments,
            userTriggered: userTriggered,
            sessionId: sessionId
        )
    }
}
