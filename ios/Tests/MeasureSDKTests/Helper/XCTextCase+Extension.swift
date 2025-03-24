//
//  XCTextCase+Extension.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import XCTest
@testable import Measure

extension XCTestCase {
    func getLogMessage(_ app: XCUIApplication) -> String {
        let labelMessage = app.staticTexts["log-output-label-message"]
        return labelMessage.label
    }

    func getLogData<T>(_ app: XCUIApplication, _ type: T.Type) -> T? where T: Decodable {
        let labelMessage = app.staticTexts["log-output-label-data"]
        if let jsonData = labelMessage.label.data(using: .utf8) {
            let data = try? JSONDecoder().decode(T.self, from: jsonData)
            return data
        }
        return nil
    }
}
