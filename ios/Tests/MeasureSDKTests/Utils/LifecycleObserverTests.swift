//
//  LifecycleObserverTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import XCTest
@testable import Measure

final class LifecycleObserverTests: XCTestCase {
    var lifecycleObserver: LifecycleObserver!

    override func setUp() {
        super.setUp()
        lifecycleObserver = LifecycleObserver()
    }

    override func tearDown() {
        lifecycleObserver = nil
        super.tearDown()
    }

    func testApplicationDidEnterBackground() {
        let expectation = XCTestExpectation(description: "applicationDidEnterBackground closure should be called")

        lifecycleObserver.applicationDidEnterBackground = {
            expectation.fulfill()
        }

        NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)

        wait(for: [expectation], timeout: 1.0)
    }

    func testApplicationWillEnterForeground() {
        let expectation = XCTestExpectation(description: "applicationWillEnterForeground closure should be called")

        lifecycleObserver.applicationWillEnterForeground = {
            expectation.fulfill()
        }

        NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)

        wait(for: [expectation], timeout: 1.0)
    }

    func testApplicationWillTerminate() {
        let expectation = XCTestExpectation(description: "applicationWillTerminate closure should be called")

        lifecycleObserver.applicationWillTerminate = {
            expectation.fulfill()
        }

        NotificationCenter.default.post(name: UIApplication.willTerminateNotification, object: nil)

        wait(for: [expectation], timeout: 1.0)
    }
}
