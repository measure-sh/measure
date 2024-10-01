//
//  MockSystemTime.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockSystemTime: SystemTime {
    var timeIntervalSince1970: MeasureSDK.Number
    var systemUptime: MeasureSDK.Number
    var iso8601Timestamp: String

    init(timeIntervalSince1970: MeasureSDK.Number, systemUptime: MeasureSDK.Number, iso8601Timestamp: String) {
        self.timeIntervalSince1970 = timeIntervalSince1970
        self.systemUptime = systemUptime
        self.iso8601Timestamp = iso8601Timestamp
    }

    func iso8601Timestamp(timeInMillis: MeasureSDK.Number) -> String {
        return iso8601Timestamp
    }
}
