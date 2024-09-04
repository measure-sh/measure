//
//  MockLogger.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockLogger: Logger {
    var enabled: Bool

    init(enabled: Bool) {
        self.enabled = enabled
    }

    func log(level: MeasureSDK.LogLevel, message: String, error: (any Error)?) {}
}
