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
            case MethodConstants.functionTrackException:
                try handleTrackException(call, result: result)
            case MethodConstants.functionNativeCrash:
                try triggerNativeCrash()
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
    
    
    private func handleTrackException(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        let reader = MethodCallReader(call)
        let serializedData: [String: Any] = try reader.requireArg(MethodConstants.argExceptionData)
        let timestamp: Int64 = try reader.requireArg(MethodConstants.argTimestamp)
        // Extract exception data from serializedData
        guard let exceptionsArray = serializedData["exceptions"] as? [[String: Any]] else {
               throw MethodArgumentError(code: "invalid_argument", message: "Missing or invalid 'exceptions' field", details: "nil")
           }

           // Process exceptions array more explicitly to help type inference
           var exceptions: [ExceptionDetail] = []
           // Process each exception entry manually
           for exceptionMap in exceptionsArray {
               guard let framesArray = exceptionMap["frames"] as? [[String: Any]] else {
                   print("Warning: Missing or invalid 'frames' in exception")
                   continue
               }
               
               // Process frames array manually
               var frames: [StackFrame] = []
               for frameMap in framesArray {
                   let frame = StackFrame(
                       binaryName: nil,
                       binaryAddress: nil,
                       offset: nil,
                       frameIndex: nil,
                       symbolAddress: nil,
                       inApp: true, // Assuming frames from Flutter are in-app code
                       className: frameMap["class_name"] as? String,
                       methodName: frameMap["method_name"] as? String,
                       fileName: frameMap["file_name"] as? String,
                       lineNumber: (frameMap["line_num"] as? NSNumber)?.intValue,
                       columnNumber: (frameMap["col_num"] as? NSNumber)?.intValue,
                       moduleName: frameMap["module_name"] as? String,
                       instructionAddr: frameMap["instruction_addr"] as? String
                   )
                   frames.append(frame)
               }
               
               // Create exception detail with processed frames
               let exceptionDetail = ExceptionDetail(
                   type: exceptionMap["type"] as? String,
                   message: exceptionMap["message"] as? String,
                   frames: frames,
                   signal: nil,
                   threadName: "",
                   threadSequence: 0 as Int64, // Explicitly cast to Number (Int64)
                   osBuildNumber: ""
               )
               
               exceptions.append(exceptionDetail)
           }

        guard let handled = serializedData["handled"] as? Bool else {
            throw MethodArgumentError(code: "invalid_argument", message: "Missing or invalid 'handled' field", details: "")
        }

        let exceptionData = Exception(
            handled: handled,
            exceptions: exceptions,
            foreground: serializedData["foreground"] as? Bool ?? true,
            threads: nil, // Assuming threads are handled differently or not directly mapped here
            binaryImages: nil // Assuming binaryImages are handled differently or not directly mapped here
        )

        // Process the exception data
        Measure.shared.internalTrackException(exceptionData, timestamp: timestamp)
        result(nil)
    }

    
    private func triggerNativeCrash() throws {
        let pointer = UnsafeMutablePointer<Int>.allocate(capacity: 1)
        pointer.deallocate()
        pointer.pointee = 42
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
