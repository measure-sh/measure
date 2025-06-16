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
    static let functionTriggerNativeCrash = "triggerNativeCrash"
    static let functionInitializeNativeSdk = "initializeNativeSDK"
    static let functionGetSessionId = "getSessionId"
    static let functionTrackSpan = "trackSpan"
    static let functionStart = "start"
    static let functionStop = "stop"

    // arguments
    static let argEventData = "event_data"
    static let argEventType = "event_type"
    static let argTimestamp = "timestamp"
    static let argUserDefinedAttrs = "user_defined_attrs"
    static let argUserTriggered = "user_triggered"
    static let argThreadName = "thread_name"
    static let argConfig = "config"
    static let argClientInfo = "client_info"
    static let argSpanName = "name"
    static let argSpanTraceId = "traceId"
    static let argSpanId = "id"
    static let argSpanParentId = "parentId"
    static let argSpanStartTime = "startTime"
    static let argSpanEndTime = "endTime"
    static let argSpanDuration = "duration"
    static let argSpanStatus = "status"
    static let argSpanAttributes = "attributes"
    static let argSpanUserDefinedAttrs = "userDefinedAttrs"
    static let argSpanCheckpoints = "checkpoints"
    static let argSpanHasEnded = "hasEnded"
    static let argSpanIsSampled = "isSampled"
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
