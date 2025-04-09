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
                details: error.localizedDescription // TODO
            ))
        }
    }


    private func handleTrackException(_ call: FlutterMethodCall, result: @escaping FlutterResult) throws {
        let reader = MethodCallReader(call)
        let serializedData: [String: Any] = try reader.requireArg(MethodConstants.argSerializedException)
        let timestamp: Int64 = try reader.requireArg(MethodConstants.argTimestamp)
        guard let exceptionsArray = serializedData[MethodConstants.exceptionExceptions] as? [[String: Any]] else {
               throw MethodArgumentError(code: "invalid_argument", message: "Missing or invalid 'exceptions' field", details: "") // TODO
           }
           var exceptions: [ExceptionDetail] = []
           for exceptionMap in exceptionsArray {
               guard let framesArray = exceptionMap[MethodConstants.exceptionFrames] as? [[String: Any]] else {
                    throw MethodArgumentError(code: "invalid_argument", message: "Missing or invalid 'frames' in exception", details: "nil")  // TODO
               }
               var frames: [StackFrame] = []
               for frameMap in framesArray {
                   let frame = StackFrame(
                       binaryName: nil,
                       binaryAddress: frameMap[MethodConstants.exceptionFrameBinaryAddr] as? String,
                       offset: nil,
                       frameIndex: frameMap[MethodConstants.exceptionFrameIndex] as? Number,
                       symbolAddress: nil,
                       inApp: true, // TODO
                       className: frameMap[MethodConstants.exceptionFrameClassName] as? String,
                       methodName: frameMap[MethodConstants.exceptionFrameMethodName] as? String,
                       fileName: frameMap[MethodConstants.exceptionFrameFileName] as? String,
                       lineNumber: frameMap[MethodConstants.exceptionFrameLineNum] as? Number,
                       columnNumber: frameMap[MethodConstants.exceptionFrameColNum] as? Number,
                       moduleName: frameMap[MethodConstants.exceptionFrameModuleName] as? String,
                       instructionAddr: frameMap[MethodConstants.exceptionFrameInstructionAddr] as? String
                   )
                   frames.append(frame)
               }
               let exceptionDetail = ExceptionDetail(
                   type: exceptionMap[MethodConstants.exceptionType] as? String,
                   message: exceptionMap[MethodConstants.exceptionMessage] as? String,
                   frames: frames,
                   signal: nil,
                   threadName: "", // TODO
                   threadSequence: 0 as Int64, // TODO
                   osBuildNumber: "" // TODO
               )
               exceptions.append(exceptionDetail)
           }

        guard let handled = serializedData[MethodConstants.exceptionHandled] as? Bool else {
            throw MethodArgumentError(code: "invalid_argument", message: "Missing or invalid 'handled' field", details: "")
        }

        let exceptionData = Exception(
            handled: handled,
            exceptions: exceptions,
            foreground: true,
            threads: nil,
            binaryImages: nil
        )
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
