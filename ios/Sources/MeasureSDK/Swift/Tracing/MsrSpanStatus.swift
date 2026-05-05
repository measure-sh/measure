//
//  MsrSpanStatus.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/05/26.
//

import Foundation

/// Objective-C compatible span status. Use this type when calling span APIs from Objective-C.
///
/// In Swift, use `SpanStatus` directly instead.
@objc public enum MsrSpanStatus: Int {
    /// Default value. The operation's outcome is unset.
    case unset = 0

    /// The operation completed successfully.
    case ok = 1 // swiftlint:disable:this identifier_name

    /// The operation ended in a failure.
    case error = 2
}

extension MsrSpanStatus {
    var spanStatus: SpanStatus {
        switch self {
        case .unset: return .unset
        case .ok: return .ok
        case .error: return .error
        }
    }
}
