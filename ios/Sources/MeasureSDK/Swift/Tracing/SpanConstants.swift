//
//  SpanConstants.swift
//  Measure
//
//  Created by Adwin Ross on 23/04/25.
//

import Foundation

/// Centralized definitions of span names created by the Measure SDK.
enum SpanName {
    private static let viewControllerTtidPrefix = "VC TTID"

    /// Returns the span name for a ViewController TTID span, truncated if necessary.
    static func viewControllerTtidSpan(className: String, maxLength: Int) -> String {
        return truncateClassNameIfNeeded(prefix: viewControllerTtidPrefix, className: className, maxLength: maxLength)
    }

    /// Truncates the class name to fit within the specified maximum length, including the prefix.
    private static func truncateClassNameIfNeeded(prefix: String, className: String, maxLength: Int) -> String {
        let fullString = "\(prefix) \(className)"
        guard fullString.count > maxLength else {
            return fullString
        }
        let availableSpace = maxLength - prefix.count - 1
        let truncatedClassName = String(className.prefix(availableSpace))
        return "\(prefix) \(truncatedClassName)"
    }
}

/// Centralized definitions of span attributes for spans created by the Measure SDK.
enum AttributeName {
    /// Indicates whether this ViewController was the first one launched during app startup.
    static let appStartupFirstViewController = "app_startup_first_viewcontroller"
}

/// Centralized definitions of checkpoint names for checkpoints created by the Measure SDK.
enum CheckpointName {
    static let vcLoadView = "vc_load_view"
    static let vcViewWillAppear = "vc_view_will_appear"
    static let vcViewDidLoad = "vc_view_did_load"
    static let vcViewDidAppear = "vc_view_did_appear"
}
