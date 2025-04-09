//
//  MethodConstants.swift
//  measure_flutter
//
//  Created by Abhay Sood on 12/02/25.
//

import Foundation

enum MethodConstants {
    // Function names
    static let functionTrackCustomEvent = "trackCustomEvent"
    static let functionTrackException = "trackException"
    static let functionNativeCrash = "triggerNativeCrash"

    // Argument keys
    static let argName = "name"
    static let argTimestamp = "timestamp"
    static let argAttributes = "attributes"
    static let argSerializedException = "serialized_exception"

    // Exception object
    static let exceptionExceptions = "exceptions"
    static let exceptionHandled = "handled"
    static let exceptionType = "type"
    static let exceptionMessage = "message"
    static let exceptionFrames = "frames"
    static let exceptionFrameClassName = "class_name"
    static let exceptionFrameMethodName = "method_name"
    static let exceptionFrameFileName = "file_name"
    static let exceptionFrameLineNum = "line_num"
    static let exceptionFrameModuleName = "module_name"
    static let exceptionFrameColNum = "col_num"
    static let exceptionFrameIndex = "index"
    static let exceptionFrameBinaryAddr = "binary_addr"
    static let exceptionFrameInstructionAddr = "instruction_addr"

    // Error codes
    static let errorInvalidArgument = "invalid_argument"
    static let errorArgumentMissing = "argument_missing"
    static let errorInvalidAttribute = "invalid_attribute"
    static let errorUnknown = "unknown_error"
}
