import Flutter
import UIKit
import XCTest


@testable import measure_flutter

class RunnerTests: XCTestCase {

    func testTrackCustomEvent_succeedsWithExpectedArguments() {
        // Given
        let plugin = MeasurePlugin()
        let call = getTrackCustomEventCall()
        let result = TestResult()
        
        // When
        plugin.handle(call, result: result.closure)
        
        // Then
        result.assertSuccess(expectedResult: nil)
    }
    
    private func getTrackCustomEventCall(
       eventName: String = "test_event",
       timestamp: Int64 = 98765432767,
       attributes: [String: Any] = [
           "string_key": "value",
           "number_key": 123,
           "boolean_key": true,
           "double_key": 3.14
       ]
    ) -> FlutterMethodCall {
       return FlutterMethodCall(
           methodName: MethodConstants.functionTrackCustomEvent,
           arguments: [
               MethodConstants.argName: eventName,
               MethodConstants.argTimestamp: timestamp,
               MethodConstants.argAttributes: attributes
           ]
       )
    }

}
