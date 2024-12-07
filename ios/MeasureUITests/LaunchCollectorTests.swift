//
//  LaunchCollectorTests.swift
//  MeasureUITests
//
//  Created by Adwin Ross on 19/11/24.
//

import XCTest

final class LaunchCollectorTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testHotLaunch() throws {
        let app = XCUIApplication()
        app.launch()

        XCUIDevice.shared.press(.home)
        sleep(1)

        app.activate()
        sleep(1)

        let logMessage = getLogMessage(app)
        XCTAssertTrue(logMessage.contains("hotLaunch"), "Hot launch event not detected.")
    }
}
