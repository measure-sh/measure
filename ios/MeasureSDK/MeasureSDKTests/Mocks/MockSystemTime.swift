//
//  MockSystemTime.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 06/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockSystemTime: SystemTime {
    var timeIntervalSince1970: Int64
    var systemUptime: Int64
    var timeInMillis: String

    init(timeIntervalSince1970: Int64, systemUptime: Int64, timeInMillis: String) {
        self.timeIntervalSince1970 = timeIntervalSince1970
        self.systemUptime = systemUptime
        self.timeInMillis = timeInMillis
    }

    func iso8601Timestamp(timeInMillis: Int64) -> String {
        return self.timeInMillis
    }
}
