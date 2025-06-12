//
//  SignPost.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 07/09/24.
//

import Foundation
import os.signpost

struct SignPost {
    private static let logger = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "com.measure.MeasureSDK", category: "Measure")
    private static let maxLabelLength = 127

    static func trace<T>(
        subcategory: StaticString,
        label: @autoclosure () -> String,
        block: () -> T
    ) -> T {
        let signpostID = OSSignpostID(log: logger)

        os_signpost(.begin, log: logger, name: subcategory, signpostID: signpostID, "%{public}@", label())
        defer {
            os_signpost(.end, log: logger, name: subcategory, signpostID: signpostID)
        }
        return block()
    }
}
