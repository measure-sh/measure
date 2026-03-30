//
//  MeasureLoggerTests.swift
//  MeasureSDKTests
//

import XCTest
@testable import Measure

final class MeasureLoggerTests: XCTestCase {
    var sut: MeasureLogger!

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    // MARK: - setLogCallback

    func test_log_invokesCallbackBeforeEnabledGuard() {
        sut = MeasureLogger(enabled: false)

        var callbackInvoked = false
        sut.setLogCallback { _, _, _ in
            callbackInvoked = true
        }

        sut.log(level: .debug, message: "test", error: nil, data: nil)

        XCTAssertTrue(callbackInvoked, "Callback should be invoked even when logger is disabled")
    }

    func test_log_callbackReceivesCorrectLevelAndMessage() {
        sut = MeasureLogger(enabled: true)

        var capturedLevel: LogLevel?
        var capturedMessage: String?
        sut.setLogCallback { level, message, _ in
            capturedLevel = level
            capturedMessage = message
        }

        sut.log(level: .warning, message: "something happened", error: nil, data: nil)

        XCTAssertEqual(capturedLevel, .warning)
        XCTAssertEqual(capturedMessage, "something happened")
    }

    func test_log_callbackReceivesError() {
        sut = MeasureLogger(enabled: true)

        var capturedError: Error?
        sut.setLogCallback { _, _, error in
            capturedError = error
        }

        let testError = NSError(domain: "test", code: 42, userInfo: nil)
        sut.log(level: .error, message: "fail", error: testError, data: nil)

        XCTAssertNotNil(capturedError)
        XCTAssertEqual((capturedError as? NSError)?.code, 42)
    }

    func test_setLogCallback_nil_removesCallback() {
        sut = MeasureLogger(enabled: true)

        var callbackInvoked = false
        sut.setLogCallback { _, _, _ in
            callbackInvoked = true
        }

        // Remove the callback
        sut.setLogCallback(nil)

        sut.log(level: .debug, message: "test", error: nil, data: nil)

        XCTAssertFalse(callbackInvoked, "Callback should not be invoked after being set to nil")
    }

    func test_internalLog_doesNotInvokeCallback() {
        // internalLog is compiled out unless INTERNAL_LOGGING is defined.
        // In normal test builds the flag is absent, so internalLog is a no-op
        // and the callback must NOT fire.
        sut = MeasureLogger(enabled: true)

        var callbackInvoked = false
        sut.setLogCallback { _, _, _ in
            callbackInvoked = true
        }

        sut.internalLog(level: .debug, message: "internal", error: nil, data: nil)

        XCTAssertFalse(callbackInvoked, "internalLog should not invoke callback in non-INTERNAL_LOGGING builds")
    }
}
