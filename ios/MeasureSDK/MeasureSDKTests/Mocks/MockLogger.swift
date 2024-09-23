//
//  MockLogger.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockLogger: Logger {
    var enabled: Bool = false

    func log(level: MeasureSDK.LogLevel, message: String, error: (any Error)?) {}
    func internalLog(level: MeasureSDK.LogLevel, message: String, error: (any Error)?) {}
}
