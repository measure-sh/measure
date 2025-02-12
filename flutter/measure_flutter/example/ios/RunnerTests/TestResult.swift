//
//  TestMethodResult.swift
//  Runner
//
//  Created by Abhay Sood on 13/02/25.
//
import Flutter
import UIKit
import XCTest


@testable import measure_flutter

class TestResult {
    enum ResultState {
        case initial
        case success(Any?)
        case error(code: String, message: String?, details: Any?)
        case notImplemented
    }
    
    private var state: ResultState = .initial
    
    var closure: FlutterResult {
        return { result in
            switch self.state {
            case .initial:
                self.state = .success(result)
            default:
                preconditionFailure("Result was already set: \(self.state)")
            }
        }
    }
    
    func assertSuccess() {
        guard case .success = state else {
            XCTFail("Expected success but was \(state)")
            return
        }
    }
    
    func assertSuccess(expectedResult: Any?) {
        guard case let .success(result) = state else {
            XCTFail("Expected success with \(String(describing: expectedResult)) but was \(state)")
            return
        }
        XCTAssertEqual(result as? NSObject, expectedResult as? NSObject)
    }
}
