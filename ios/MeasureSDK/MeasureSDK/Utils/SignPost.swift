//
//  SignPost.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 07/09/24.
//

import Foundation
import os.signpost

struct SignPost {
    private static let logger = OSLog(subsystem: logTag, category: "Measure")
    private static let maxLabelLength = 127

    static func trace<T>(
        label: @autoclosure () -> String,
        block: () -> T
    ) -> T {
#if INTERNAL_LOGGING
        let signpostID = OSSignpostID(log: logger)

        os_signpost(.begin, log: logger, name: "performance", signpostID: signpostID, "%{public}@", label())
        defer {
            os_signpost(.end, log: logger, name: "performance", signpostID: signpostID)
        }
#endif
        return block()
    }
}
