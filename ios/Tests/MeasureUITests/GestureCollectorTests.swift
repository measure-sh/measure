//
//  GestureCollectorTests.swift
//  MeasureUITests
//
//  Created by Adwin Ross on 08/10/24.
//

import XCTest
import UIKit
@testable import Measure

class GestureCollectorTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testClickGesture() throws {
        let app = XCUIApplication()
        app.launch()

        sleep(5)

        let button = app.buttons["SwiftUI Controller"]
        XCTAssertTrue(button.exists, "The 'Swift Controller' button does not exist.")

        if button.exists {
            button.tap()

            sleep(1)

            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("gestureClick"), "Click gesture not detected.")

            let logData = getLogData(app, ClickData.self)
            XCTAssertNotNil(logData, "Failed to decode GestureData.")
            XCTAssertEqual(logData?.target, "UIButtonLabel", "Expected gesture target to be 'UIButtonLabel'.")
        }
    }

    func testLongClickGesture() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["SwiftUI Controller"]
        XCTAssertTrue(button.exists, "The 'Swift Controller' button does not exist.")

        if button.exists {
            button.press(forDuration: 1.0)

            sleep(1)

            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("gestureLongClick"), "Long click gesture not detected.")

            let logData = getLogData(app, LongClickData.self)
            XCTAssertNotNil(logData, "Failed to decode GestureData.")
            XCTAssertEqual(logData?.target, "UIButtonLabel", "Expected gesture target to be 'UIButtonLabel'.")
        }
    }

    func testScroll() throws {
        let app = XCUIApplication()
        app.launch()

        let tableView = app.tables["HomeTableView"]
        XCTAssertTrue(tableView.exists, "The 'HomeTableView' does not exist.")

        if tableView.exists {
            tableView.swipeUp()

            sleep(1)

            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("gestureScroll"), "Scroll gesture not detected.")

            let logData = getLogData(app, ScrollData.self)
            XCTAssertNotNil(logData, "Failed to decode GestureData.")
            XCTAssertEqual(logData?.target, "UITableView", "Expected gesture target to be 'UITableView'.")
        }
    }
}
