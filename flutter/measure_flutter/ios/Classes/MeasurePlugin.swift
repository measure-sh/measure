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
        processCustomEvent(name: name, timestamp: timestamp, attributes: convertedAttributes)
        
        result(nil)
    }
    
    private func processCustomEvent(name: String, timestamp: Int64, attributes: [String: AttributeValue]) {
        Measure.shared.trackEvent(name: name, attributes: attributes, timestamp: timestamp)
    }
}
