//
//  LifecycleCollectorTests.swift
//  MeasureUITests
//
//  Created by Adwin Ross on 30/10/24.
//

import XCTest
import UIKit
@testable import Measure

final class LifecycleCollectorTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testViewDidLoad() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["Swift Controller"]
        XCTAssertTrue(button.exists, "The 'Swift Controller' button does not exist.")

        if button.exists {
            button.tap()

            sleep(1)
            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("lifecycleViewController"), "lifecycleViewController event not detected.")
            XCTAssertTrue(logMessage.contains("viewDidLoad"), "viewDidLoad event not detected.")
        }
    }

    func testViewDidAppear() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["Swift Controller"]
        XCTAssertTrue(button.exists, "The 'Swift Controller' button does not exist.")

        if button.exists {
            button.tap()

            sleep(1)
            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("lifecycleViewController"), "lifecycleViewController event not detected.")
            XCTAssertTrue(logMessage.contains("viewDidAppear"), "viewDidAppear event not detected.")
        }
    }

    func testViewDidDisappear() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["Swift Controller"]
        XCTAssertTrue(button.exists, "The 'Swift Controller' button does not exist.")

        if button.exists {
            button.tap()

            sleep(1)
            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("lifecycleViewController"), "lifecycleViewController event not detected.")
            XCTAssertTrue(logMessage.contains("viewDidDisappear"), "viewDidDisappear event not detected.")
        }
    }

    func testLoadView() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["Swift Controller"]
        XCTAssertTrue(button.exists, "The 'Swift Controller' button does not exist.")

        if button.exists {
            button.tap()

            sleep(1)
            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("lifecycleViewController"), "lifecycleViewController event not detected.")
            XCTAssertTrue(logMessage.contains("loadView"), "loadView event not detected.")
        }
    }

    func testVCDeinit() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["Swift Controller"]
        button.tap()

        let backButton = app.buttons["Swift View Controller"]
        backButton.tap()
        sleep(1)
        let logMessage = getLogMessage(app)
        XCTAssertTrue(logMessage.contains("lifecycleViewController"), "lifecycleViewController event not detected.")
        XCTAssertTrue(logMessage.contains("vcDeinit"), "vcDeinit event not detected.")
    }

    func testViewWillAppear() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["Swift Controller"]
        XCTAssertTrue(button.exists, "The 'Swift Controller' button does not exist.")

        if button.exists {
            button.tap()

            sleep(1)
            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("lifecycleViewController"), "lifecycleViewController event not detected.")
            XCTAssertTrue(logMessage.contains("viewWillAppear"), "viewWillAppear event not detected.")
        }
    }

    func testViewWillDisappear() throws {
        let app = XCUIApplication()
        app.launch()

        let button = app.buttons["Swift Controller"]
        XCTAssertTrue(button.exists, "The 'Swift Controller' button does not exist.")

        if button.exists {
            button.tap()

            sleep(1)
            let logMessage = getLogMessage(app)
            XCTAssertTrue(logMessage.contains("lifecycleViewController"), "lifecycleViewController event not detected.")
            XCTAssertTrue(logMessage.contains("viewWillDisappear"), "viewWillDisappear event not detected.")
        }
    }
}
