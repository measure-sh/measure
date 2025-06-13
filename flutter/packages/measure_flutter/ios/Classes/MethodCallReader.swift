//
//  MethodCallReader.swift
//  measure_flutter
//
//  Created by Abhay Sood on 12/02/25.
//

import Foundation
import Flutter

class MethodCallReader {
    private let call: FlutterMethodCall

    init(_ call: FlutterMethodCall) {
        self.call = call
    }

    func requireArg<T>(_ name: String) throws -> T {
        guard let arguments = call.arguments as? [String: Any],
              let value = arguments[name] as? T else {
            throw MethodArgumentError(
                code: ErrorCode.errorArgumentMissing,
                message: "Required argument '\(name)' was not provided",
                details: "Method: \(call.method)"
            )
        }
        return value
    }

    func optionalArg<T>(_ name: String) -> T? {
        guard let arguments = call.arguments as? [String: Any] else {
            return nil
        }
        return arguments[name] as? T
    }
}
