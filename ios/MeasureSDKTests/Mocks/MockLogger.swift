//
//  MockLogger.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockLogger: Logger {
    var enabled: Bool = true
    var logs = [String]()
    var onLog: ((MeasureSDK.LogLevel, String, (any Error)?, Encodable?) -> Void)?
    var onInternalLog: ((MeasureSDK.LogLevel, String, (any Error)?, Encodable?) -> Void)?

    func log(level: MeasureSDK.LogLevel, message: String, error: (any Error)?, data: Encodable?) {
        onLog?(level, message, error, data)
        logs.append(message)
    }

    func internalLog(level: MeasureSDK.LogLevel, message: String, error: (any Error)?, data: Encodable?) {
        onInternalLog?(level, message, error, data)
        logs.append(message)
    }
}
