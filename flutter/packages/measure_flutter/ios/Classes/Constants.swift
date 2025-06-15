//
//  MethodConstants.swift
//  measure_flutter
//
//  Created by Abhay Sood on 12/02/25.
//

import Foundation

enum MethodConstants {
    // functions
    static let functionTrackEvent = "trackEvent"
    static let functionTrackSpan = "trackSpan"
    static let functionTriggerNativeCrash = "triggerNativeCrash"
    static let functionInitializeNativeSdk = "initializeNativeSDK"

    // arguments
    static let argEventData = "event_data"
    static let argEventType = "event_type"
    static let argSpanData = "span_data"
    static let argTimestamp = "timestamp"
    static let argUserDefinedAttrs = "user_defined_attrs"
    static let argUserTriggered = "user_triggered"
    static let argThreadName = "thread_name"
    static let argConfig = "config"
    static let argClientInfo = "client_info"
}

enum ErrorCode {
    static let errorInvalidArgument = "invalid_argument"
    static let errorArgumentMissing = "argument_missing"
    static let errorInvalidAttribute = "invalid_attribute"
    static let errorUnknown = "unknown_error"
}

enum Attribute {
    static let platform = "platform"
    static let platformFlutter = "flutter"
}
