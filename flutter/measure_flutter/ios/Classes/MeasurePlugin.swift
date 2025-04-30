import Flutter
import UIKit
import Measure

public class MeasurePlugin: NSObject, FlutterPlugin {
    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(name: "measure_flutter", binaryMessenger: registrar.messenger())
        let instance = MeasurePlugin()
        registrar.addMethodCallDelegate(instance, channel: channel)
    }
    
    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        do {
            switch call.method {
            case MethodConstants.functionTrackEvent:
                try handleTrackEvent(call, result: result)
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
        trackEvent(
            data: &eventData,
            type: eventType,
            timestamp: timestamp,
            userDefinedAttrs: convertedAttributes,
            userTriggered: userTriggered,
            sessionId: nil,
            threadName: threadName
        )
        result(nil)
    }
    
    private func trackEvent(data: inout [String: Any?], type: String, timestamp: Int64, userDefinedAttrs: [String: AttributeValue], userTriggered: Bool, sessionId: String?, threadName: String?) {
        var attributes = [String: Any?]()
        attributes[Attribute.platform] = Attribute.platformFlutter
        
        Measure.shared.internalTrackEvent(
            data: &data,
            type: type,
            timestamp: timestamp,
            attributes: attributes,
            userDefinedAttrs: userDefinedAttrs,
            userTriggered: userTriggered,
            sessionId: sessionId,
            threadName: threadName
        )
    }
}
