//
//  MethodConstants.swift
//  measure_flutter
//
//  Created by Abhay Sood on 12/02/25.
//

import Foundation

enum MethodConstants {
    static let functionTrackCustomEvent = "trackCustomEvent"
    static let functionTrackException = "trackException"
    static let functionNativeCrash = "triggerNativeCrash"
    
    static let argName = "name"
    static let argTimestamp = "timestamp"
    static let argAttributes = "attributes"
    static let argExceptionData = "exception_data"
    
    static let errorInvalidArgument = "invalid_argument"
    static let errorArgumentMissing = "argument_missing"
    static let errorInvalidAttribute = "invalid_attribute"
    static let errorUnknown = "unknown_error"
}
